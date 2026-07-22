import time

import httpx

from app.benchmark.models import DbBenchmarkResult, DbOperationStats, compute_latency_stats

_ACCOUNT_PREFIX = "dbbench-acct-"

_SUBSTITUTION_NOTE = (
    "Agent 1 only exposes one detail endpoint (GET /tokens/{token}), so 'lookup latency' "
    "and 'token detail retrieval latency' would be the same measurement under two "
    "labels. Substituted a genuinely distinct 4th operation - PATCH status-update "
    "latency - instead of double-counting one number. Isolated from Benchmark 1/3's "
    "data via a dedicated 'dbbench-acct-' synthetic account prefix, not mixed into any "
    "other benchmark's results."
)


async def run_db_benchmark(
    client: httpx.AsyncClient, base_url: str, timeout: float, sample_size: int
) -> DbBenchmarkResult:
    """Benchmark 4: real timed calls against Agent 1's token endpoints using isolated,
    clearly-labeled accounts - never reusing or polluting Benchmark 1/3's tokens.
    """
    insert_latencies: list[float] = []
    tokens: list[str] = []

    for i in range(sample_size):
        start = time.monotonic()
        resp = await client.post(
            f"{base_url}/tokens/generate",
            json={
                "account_id": f"{_ACCOUNT_PREFIX}{i:06d}",
                "receiver_account_id": f"{_ACCOUNT_PREFIX}{(i + 1) % sample_size:06d}",
                "amount": 1.0,
                "transaction_type": "BENCHMARK",
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        insert_latencies.append((time.monotonic() - start) * 1000)
        tokens.append(resp.json()["transaction_id"])

    lookup_latencies: list[float] = []
    for token in tokens:
        start = time.monotonic()
        resp = await client.get(f"{base_url}/tokens/{token}", timeout=timeout)
        resp.raise_for_status()
        lookup_latencies.append((time.monotonic() - start) * 1000)

    update_latencies: list[float] = []
    for token in tokens:
        start = time.monotonic()
        resp = await client.patch(
            f"{base_url}/tokens/{token}/status",
            json={"stage": "behavioral", "status": "running"},
            timeout=timeout,
        )
        resp.raise_for_status()
        update_latencies.append((time.monotonic() - start) * 1000)

    timeline_latencies: list[float] = []
    for token in tokens:
        start = time.monotonic()
        resp = await client.get(f"{base_url}/tokens/{token}/timeline", timeout=timeout)
        resp.raise_for_status()
        timeline_latencies.append((time.monotonic() - start) * 1000)

    return DbBenchmarkResult(
        sample_size=sample_size,
        insert=DbOperationStats(operation="insert", latency=compute_latency_stats(insert_latencies)),
        lookup=DbOperationStats(operation="lookup", latency=compute_latency_stats(lookup_latencies)),
        update=DbOperationStats(operation="update", latency=compute_latency_stats(update_latencies)),
        timeline=DbOperationStats(operation="timeline", latency=compute_latency_stats(timeline_latencies)),
        substitution_note=_SUBSTITUTION_NOTE,
    )
