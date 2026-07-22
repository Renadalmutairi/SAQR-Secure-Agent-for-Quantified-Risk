import httpx

from app.benchmark.models import ProductionReadinessItem
from app.config import Settings


async def check_production_readiness(client: httpx.AsyncClient, settings: Settings) -> list[ProductionReadinessItem]:
    """Every item is honestly sub-labeled: items with a cheap live check performed
    right now are 'live-verified'; static architectural facts already true of this
    build are 'present-in-build' - never a blanket, unlabeled checkmark."""
    services = {
        "Behavioral DNA Engine (Agent 1)": f"{settings.behavioral_dna_base_url}/health",
        "Graph Intelligence Engine (Agent 2)": f"{settings.graph_intelligence_base_url}/health",
        "Trust Intelligence Engine (Agent 3)": f"{settings.trust_intelligence_base_url}/health",
        "Compliance Intelligence Engine (Agent 4)": f"{settings.compliance_base_url}/health",
        "Decision Intelligence Engine (Agent 5)": f"{settings.decision_base_url}/health",
    }
    healthy = 0
    for url in services.values():
        try:
            resp = await client.get(url, timeout=3.0)
            if resp.status_code == 200:
                healthy += 1
        except (httpx.HTTPError, httpx.TimeoutException):
            pass
    total = len(services)

    db_online = False
    try:
        resp = await client.get(f"{settings.behavioral_dna_base_url}/tokens/db-status", timeout=3.0)
        db_online = resp.status_code == 200 and resp.json().get("database") == "online"
    except (httpx.HTTPError, httpx.TimeoutException):
        pass

    return [
        ProductionReadinessItem(
            label="Health Monitoring",
            ok=(healthy == total),
            label_kind="live-verified",
            detail=f"{healthy}/{total} agents responded healthy at report generation time",
        ),
        ProductionReadinessItem(
            label="PostgreSQL",
            ok=db_online,
            label_kind="live-verified",
            detail="Real SELECT 1 via Agent 1" if db_online else "Postgres unreachable at report generation time",
        ),
        ProductionReadinessItem(
            label="Dockerized Architecture",
            ok=True,
            label_kind="present-in-build",
            detail="All 10 services run as Docker containers via docker-compose.yml",
        ),
        ProductionReadinessItem(
            label="Kafka",
            ok=True,
            label_kind="present-in-build",
            detail="Agent 1 -> Agent 2 event stream (saqr.behavioral-dna.profile-updates)",
        ),
        ProductionReadinessItem(
            label="Neo4j",
            ok=True,
            label_kind="present-in-build",
            detail="Agent 2's graph store (Louvain/PageRank/betweenness via GDS)",
        ),
        ProductionReadinessItem(
            label="REST APIs",
            ok=True,
            label_kind="present-in-build",
            detail="Every agent exposes a typed FastAPI REST contract",
        ),
        ProductionReadinessItem(
            label="Multi-Agent Architecture",
            ok=True,
            label_kind="present-in-build",
            detail="5 independently deployable agents plus an orchestration/visualization layer",
        ),
        ProductionReadinessItem(
            label="Token Traceability",
            ok=True,
            label_kind="present-in-build",
            detail="SAQR token = transaction_id, threaded through all 5 agents' existing contracts unchanged",
        ),
        ProductionReadinessItem(
            label="Audit Trail",
            ok=True,
            label_kind="present-in-build",
            detail="Immutable token_audit_events table, append-only",
        ),
        ProductionReadinessItem(
            label="Benchmark Validation",
            ok=True,
            label_kind="present-in-build",
            detail="This suite - 5 benchmarks executed against the real backend",
        ),
        ProductionReadinessItem(
            label="Infrastructure Cost Analysis",
            ok=True,
            label_kind="present-in-build",
            detail="Real docker stats + real Postgres size, explicitly labeled cost formula",
        ),
    ]
