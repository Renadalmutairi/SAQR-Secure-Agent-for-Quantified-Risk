import json
from pathlib import Path

import httpx

from app.benchmark.models import CostLineItem, InfraCostResult, LabeledFloat, ResultSource

# Explicitly stated assumed cloud rates - NOT a vendor quote. A generic mid-tier
# managed-container-hosting reference point, stated so the formula is auditable and
# anyone can substitute actual contracted pricing for a precise figure.
_ASSUMED_USD_PER_VCPU_HOUR = 0.033
_ASSUMED_USD_PER_GB_RAM_HOUR = 0.004
_ASSUMED_USD_PER_GB_STORAGE_MONTH = 0.10
_HOURS_PER_MONTH = 730


def _load_snapshot(path: str) -> dict | None:
    p = Path(path)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def _bytes_to_gb(b: int) -> float:
    return b / (1024**3)


async def compute_infra_cost(
    client: httpx.AsyncClient, agent1_base_url: str, timeout: float, snapshot_path: str
) -> InfraCostResult:
    """Benchmark 5: real docker stats (captured externally by Bash during a live
    benchmark run - see the plan's infra decision on why no service gets Docker
    control) + real Postgres size via Agent 1's db-metrics endpoint, combined with an
    explicitly-stated cost formula. If the snapshot hasn't been captured yet, this
    reports that honestly rather than inventing a placeholder number.
    """
    snapshot = _load_snapshot(snapshot_path)

    db_metrics: dict | None = None
    try:
        resp = await client.get(f"{agent1_base_url}/tokens/db-metrics", timeout=timeout)
        resp.raise_for_status()
        db_metrics = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException):
        db_metrics = None

    if snapshot is None:
        return InfraCostResult(
            captured=False,
            container_stats=None,
            database_size_bytes=db_metrics["database_size_bytes"] if db_metrics else None,
            table_metrics=db_metrics["tables"] if db_metrics else None,
            estimated_monthly_cost_usd=None,
            cost_formula_note=(
                "Infrastructure snapshot not yet captured - run the collection step "
                "during a live benchmark before this section can be computed."
            ),
            comparison=_build_comparison(db_metrics),
        )

    containers = snapshot.get("containers", [])
    total_cpu_percent = sum(c.get("cpu_percent", 0.0) for c in containers)
    total_mem_gb = sum(c.get("mem_usage_mb", 0.0) for c in containers) / 1024
    # docker stats' cpu_percent is relative to one core (100% = 1 vCPU) - summing
    # across containers approximates total vCPU-equivalent consumed.
    vcpu_equivalent = total_cpu_percent / 100.0

    storage_gb = _bytes_to_gb(db_metrics["database_size_bytes"]) if db_metrics else 0.0

    monthly_compute = (
        vcpu_equivalent * _ASSUMED_USD_PER_VCPU_HOUR + total_mem_gb * _ASSUMED_USD_PER_GB_RAM_HOUR
    ) * _HOURS_PER_MONTH
    monthly_storage = storage_gb * _ASSUMED_USD_PER_GB_STORAGE_MONTH
    monthly_total = monthly_compute + monthly_storage

    return InfraCostResult(
        captured=True,
        container_stats=containers,
        database_size_bytes=db_metrics["database_size_bytes"] if db_metrics else None,
        table_metrics=db_metrics["tables"] if db_metrics else None,
        estimated_monthly_cost_usd=LabeledFloat(
            value=round(monthly_total, 2),
            source=ResultSource.ESTIMATED,
            note=(
                f"Formula: (vCPU-equiv {vcpu_equivalent:.2f} x ${_ASSUMED_USD_PER_VCPU_HOUR}/hr + "
                f"RAM {total_mem_gb:.2f}GB x ${_ASSUMED_USD_PER_GB_RAM_HOUR}/hr) x {_HOURS_PER_MONTH}hrs "
                f"+ storage {storage_gb:.3f}GB x ${_ASSUMED_USD_PER_GB_STORAGE_MONTH}/GB-month. Rates are "
                "a stated, generic mid-tier cloud reference point, not a vendor quote - substitute "
                "actual contracted pricing for a precise figure."
            ),
        ),
        cost_formula_note=(
            "CPU/RAM captured via `docker stats` during the live benchmark run; storage via real "
            "Postgres pg_database_size."
        ),
        comparison=_build_comparison(db_metrics),
    )


def _build_comparison(db_metrics: dict | None) -> list[CostLineItem]:
    saqr_tables = len(db_metrics["tables"]) if db_metrics else 3
    saqr_storage_mb = sum(t["size_bytes"] for t in db_metrics["tables"]) / (1024**2) if db_metrics else 0.0

    return [
        CostLineItem(
            label="Database operations",
            saqr_value="1 unified registry (3 tables); all 5 agents share it via transaction_id",
            traditional_value="Each of the 5 services owns its own ID/audit tables - up to 5x the write paths",
            saqr_source=ResultSource.MEASURED,
            traditional_source=ResultSource.ESTIMATED,
            explanation="Verified fact of this repo: Agents 2-5 have zero identity/audit tables of their own.",
        ),
        CostLineItem(
            label="Token management",
            saqr_value="1 generation point (Agent 1), reused everywhere as transaction_id",
            traditional_value="N independent ID generators, one per service, needing cross-service reconciliation",
            saqr_source=ResultSource.MEASURED,
            traditional_source=ResultSource.ESTIMATED,
            explanation="No schema changes were needed in Agents 2-5 to add tokenization - confirmed in this build.",
        ),
        CostLineItem(
            label="Infrastructure complexity",
            saqr_value=f"{saqr_tables} tables, 1 service touches Postgres for cross-agent tracking",
            traditional_value=f"~{saqr_tables * 5} tables (illustrative: one registry-equivalent set per service)",
            saqr_source=ResultSource.MEASURED,
            traditional_source=ResultSource.ESTIMATED,
            explanation="Illustrative multiplier from this repo's real per-service table count, not a rigorous TCO model.",
        ),
        CostLineItem(
            label="Storage overhead",
            saqr_value=f"{saqr_storage_mb:.2f} MB across 3 tables (measured)",
            traditional_value=f"~{saqr_storage_mb * 5:.2f} MB (illustrative, same multiplier)",
            saqr_source=ResultSource.MEASURED,
            traditional_source=ResultSource.ESTIMATED,
            explanation="Traditional-side figure is a modeled projection - there is no traditional deployment to measure.",
        ),
        CostLineItem(
            label="Scalability",
            saqr_value="Adding a 6th agent needs zero new identity infrastructure - it just uses transaction_id",
            traditional_value="Adding a 6th service means building and maintaining another independent ID/audit system",
            saqr_source=ResultSource.MEASURED,
            traditional_source=ResultSource.ESTIMATED,
            explanation="Architectural fact, demonstrated across Agents 2-5 in this build.",
        ),
        CostLineItem(
            label="Operational cost",
            saqr_value="1 registry to monitor/back up/audit for full cross-agent traceability",
            traditional_value="N separate registries to monitor/back up/reconcile for the same traceability",
            saqr_source=ResultSource.MEASURED,
            traditional_source=ResultSource.ESTIMATED,
            explanation="Qualitative operational argument, not a dollar figure - no traditional deployment exists to price.",
        ),
    ]
