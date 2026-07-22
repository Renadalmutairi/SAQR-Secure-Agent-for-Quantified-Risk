import asyncio

import httpx

from app.benchmark.models import TraceabilityResult

_COMPLETED = "completed"


async def run_traceability_check(
    client: httpx.AsyncClient, base_url: str, timeout: float, tokens: list[str], concurrency: int = 20
) -> TraceabilityResult:
    """Benchmark 3: re-queries Agent 1's real registry for every token that actually
    went through Benchmark 1's real pipeline run (the only tokens that ever touched all
    5 agents) and checks the 5 real status columns. No new writes, no simulation - a
    read-only audit of what the run actually produced.
    """
    semaphore = asyncio.Semaphore(concurrency)
    counters = {"behavioral": 0, "graph": 0, "trust": 0, "compliance": 0, "decision": 0}
    fully_traced = 0
    checked = 0

    async def check_one(token: str) -> None:
        nonlocal fully_traced, checked
        async with semaphore:
            try:
                resp = await client.get(f"{base_url}/tokens/{token}", timeout=timeout)
                resp.raise_for_status()
                registry = resp.json()["registry"]
            except (httpx.HTTPError, httpx.TimeoutException):
                checked += 1
                return

        statuses = {
            "behavioral": registry["behavioral_status"],
            "graph": registry["graph_status"],
            "trust": registry["trust_status"],
            "compliance": registry["compliance_status"],
            "decision": registry["decision_status"],
        }
        for stage, status in statuses.items():
            if status == _COMPLETED:
                counters[stage] += 1
        if all(status == _COMPLETED for status in statuses.values()):
            fully_traced += 1
        checked += 1

    await asyncio.gather(*(check_one(t) for t in tokens))

    return TraceabilityResult(
        tokens_checked=checked,
        behavioral_completed=counters["behavioral"],
        graph_completed=counters["graph"],
        trust_completed=counters["trust"],
        compliance_completed=counters["compliance"],
        decision_completed=counters["decision"],
        fully_traced=fully_traced,
        success_rate=(fully_traced / checked) if checked else 0.0,
    )
