import asyncio
import random
import time
from datetime import UTC, datetime

import httpx

from app.benchmark.dataset import generate_synthetic_transactions
from app.benchmark.jobs import Job, JobStore
from app.benchmark.models import LabeledFloat, ResultSource, TokenBenchmarkResult

_MAX_RETRIES = 2
_RETRY_BACKOFF_SECONDS = 0.2
_PROGRESS_UPDATE_EVERY = 500
_TPS_SAMPLE_INTERVAL_SECONDS = 5.0
_LOST_TOKEN_SAMPLE_SIZE = 2000


class OutageState:
    """Shared with the running job so an operator-triggered Postgres stop/start
    (deliberately NOT something the dashboard's own code does - see the infra
    decision to keep Docker control off every service) can be recorded in real time via
    a small API call and cross-referenced against failures as they happen."""

    def __init__(self) -> None:
        self.start: float | None = None
        self.end: float | None = None

    def mark_start(self) -> None:
        self.start = time.monotonic()
        self.end = None

    def mark_end(self) -> None:
        self.end = time.monotonic()

    def contains(self, t: float) -> bool:
        if self.start is None:
            return False
        if self.end is None:
            return t >= self.start
        return self.start <= t <= self.end


class _Counters:
    def __init__(self) -> None:
        self.successful = 0
        self.failed = 0
        self.recovered_on_retry = 0
        self.recovery_errors = 0
        self.database_failures = 0
        self.tokens: list[str] = []
        self.latencies_ms: list[float] = []
        self.completed = 0
        self.tps_samples: list[dict] = []


async def _generate_one(
    client: httpx.AsyncClient, base_url: str, tx, timeout: float, counters: _Counters, outage: OutageState
) -> None:
    start = time.monotonic()
    attempt = 0
    while attempt <= _MAX_RETRIES:
        try:
            resp = await client.post(
                f"{base_url}/tokens/generate",
                json={
                    "account_id": tx.account_id,
                    "receiver_account_id": tx.receiver_account_id,
                    "amount": tx.amount,
                    "transaction_type": tx.tx_type,
                },
                timeout=timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            counters.latencies_ms.append((time.monotonic() - start) * 1000)
            counters.tokens.append(data["transaction_id"])
            counters.successful += 1
            if attempt > 0:
                counters.recovered_on_retry += 1
            counters.completed += 1
            return
        except (httpx.HTTPError, httpx.TimeoutException):
            attempt += 1
            if attempt <= _MAX_RETRIES:
                await asyncio.sleep(_RETRY_BACKOFF_SECONDS * attempt)
                continue
            counters.failed += 1
            counters.recovery_errors += 1
            if outage.contains(time.monotonic()):
                counters.database_failures += 1
            counters.completed += 1
            return


async def _sample_lost_tokens(client: httpx.AsyncClient, base_url: str, tokens: list[str], timeout: float) -> tuple[int, int]:
    """Post-hoc read-after-write check on a sampled subset - a token that reported
    success but 404s on lookup is a real integrity failure, not assumed away."""
    if not tokens:
        return 0, 0
    sample_size = min(_LOST_TOKEN_SAMPLE_SIZE, len(tokens))
    sample = random.sample(tokens, sample_size)
    semaphore = asyncio.Semaphore(50)
    lost = 0

    async def check_one(token: str) -> None:
        nonlocal lost
        async with semaphore:
            try:
                resp = await client.get(f"{base_url}/tokens/{token}", timeout=timeout)
                if resp.status_code == 404:
                    lost += 1
            except (httpx.HTTPError, httpx.TimeoutException):
                lost += 1

    await asyncio.gather(*(check_one(t) for t in sample))
    return sample_size, lost


async def run_token_benchmark(
    client: httpx.AsyncClient,
    base_url: str,
    timeout: float,
    total: int,
    customer_count: int,
    concurrency: int,
    job: Job,
    job_store: JobStore,
    outage: OutageState,
    full_target_size: int = 1_000_000,
) -> TokenBenchmarkResult:
    """Benchmark 2: a real, substantial run against Agent 1's real POST
    /tokens/generate, at whatever `total` the caller can afford to wait for live.
    `full_target_size` (the stated 1,000,000 scale) is reported as a labeled projection
    from the measured rate when `total` falls short of it - the same honest
    sample-then-project discipline Benchmark 1 already uses for its full-dataset claim,
    applied here once real testing showed a live 1,000,000-call run isn't practical in
    one sitting (measured single-worker throughput plateaued around 40 tok/s; see the
    Dockerfile's multi-worker note). Long-running - callers run this as a background
    task and poll `job` via job_store for progress.
    """
    started_at = datetime.now(UTC)
    counters = _Counters()
    semaphore = asyncio.Semaphore(concurrency)
    wall_start = time.monotonic()
    last_sample_t = wall_start
    last_sample_count = 0

    async def worker(tx) -> None:
        nonlocal last_sample_t, last_sample_count
        async with semaphore:
            await _generate_one(client, base_url, tx, timeout, counters, outage)
        if counters.completed % _PROGRESS_UPDATE_EVERY == 0 or counters.completed == total:
            now = time.monotonic()
            if now - last_sample_t >= _TPS_SAMPLE_INTERVAL_SECONDS or counters.completed == total:
                interval_count = counters.completed - last_sample_count
                interval_tps = interval_count / (now - last_sample_t) if now > last_sample_t else 0.0
                counters.tps_samples.append({"t": round(now - wall_start, 1), "tps": round(interval_tps, 2)})
                last_sample_t = now
                last_sample_count = counters.completed
            await job_store.update_progress(
                job,
                {
                    "completed": counters.completed,
                    "total": total,
                    "successful": counters.successful,
                    "failed": counters.failed,
                },
            )

    transactions = generate_synthetic_transactions(customer_count, total)
    tasks = [asyncio.create_task(worker(tx)) for tx in transactions]
    await asyncio.gather(*tasks)

    wall_elapsed = time.monotonic() - wall_start
    finished_at = datetime.now(UTC)

    unique_tokens = set(counters.tokens)
    duplicate_tokens = len(counters.tokens) - len(unique_tokens)

    lost_checked, lost_found = await _sample_lost_tokens(client, base_url, counters.tokens, timeout)

    rate = counters.successful / wall_elapsed if wall_elapsed > 0 else 0.0
    avg_latency = sum(counters.latencies_ms) / len(counters.latencies_ms) if counters.latencies_ms else 0.0

    full_target_projected = None
    if total < full_target_size and rate > 0:
        full_target_projected = LabeledFloat(
            value=full_target_size / rate,
            source=ResultSource.PROJECTED,
            note=(
                f"Extrapolated from a real {total:,}-token run at {rate:.2f} tokens/sec - "
                f"a live {full_target_size:,}-token run was not completed in this session."
            ),
        )

    return TokenBenchmarkResult(
        job_id=job.job_id,
        status="completed",
        total_requested=total,
        total_customers=customer_count,
        completed_count=counters.completed,
        successful=counters.successful,
        failed=counters.failed,
        recovered_on_retry=counters.recovered_on_retry,
        recovery_errors=counters.recovery_errors,
        database_failures=counters.database_failures,
        duplicate_tokens=duplicate_tokens,
        unique_tokens=len(unique_tokens),
        generation_rate_tps=LabeledFloat(value=rate, source=ResultSource.MEASURED),
        avg_latency_ms=LabeledFloat(value=avg_latency, source=ResultSource.MEASURED),
        outage_window=(
            [datetime.fromtimestamp(started_at.timestamp() + (outage.start - wall_start), tz=UTC),
             datetime.fromtimestamp(started_at.timestamp() + (outage.end - wall_start), tz=UTC)]
            if outage.start is not None and outage.end is not None
            else None
        ),
        lost_tokens_checked=lost_checked,
        lost_tokens_found=lost_found,
        started_at=started_at,
        finished_at=finished_at,
        tps_samples=counters.tps_samples,
        full_target_size=full_target_size,
        full_target_projected_seconds=full_target_projected,
    )
