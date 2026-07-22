import asyncio
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from app.benchmark.dataset import SampleTransaction, sample_real_transactions
from app.benchmark.models import LabeledFloat, PipelineBenchmarkResult, ResultSource, compute_latency_stats
from app.orchestrator import DemoRunRequest, PipelineOrchestrator

ProgressCallback = Callable[[int, int], Awaitable[None]]


async def run_pipeline_benchmark(
    orchestrator: PipelineOrchestrator,
    csv_path: str,
    full_dataset_size: int,
    sample_size: int,
    concurrency: int,
    progress_cb: ProgressCallback | None = None,
) -> PipelineBenchmarkResult:
    """Benchmark 1: a real, concurrent sample of real transactions run through the
    existing, already-tested PipelineOrchestrator - no reimplementation of
    pipeline-calling logic. Every transaction here really executes across all 5 agents.
    """
    sample = sample_real_transactions(csv_path, sample_size)
    semaphore = asyncio.Semaphore(concurrency)

    latencies: list[float] = []
    per_stage: dict[str, list[float]] = {}
    tokens: list[str] = []
    failures: list[str] = []
    successful = 0
    failed = 0
    completed_count = 0

    async def run_one(tx: SampleTransaction) -> None:
        nonlocal successful, failed, completed_count
        async with semaphore:
            start = time.monotonic()
            request = DemoRunRequest(
                account_id=tx.account_id,
                receiver_account_id=tx.receiver_account_id,
                amount=tx.amount,
                tx_type=tx.tx_type,
            )
            try:
                result = await orchestrator.run(request)
            except Exception as exc:
                failed += 1
                failures.append(str(exc))
            else:
                duration_ms = (time.monotonic() - start) * 1000
                latencies.append(duration_ms)
                tokens.append(result.token)
                for stage in result.stages:
                    per_stage.setdefault(stage.stage, []).append(stage.duration_ms)
                if result.failed:
                    failed += 1
                    failed_stage = next((s for s in result.stages if s.status == "failed"), None)
                    failures.append(f"{failed_stage.stage}: {failed_stage.error}" if failed_stage else "unknown failure")
                else:
                    successful += 1
            completed_count += 1
            if progress_cb:
                await progress_cb(completed_count, sample_size)

    started_at = datetime.now(UTC)
    wall_start = time.monotonic()
    await asyncio.gather(*(run_one(tx) for tx in sample))
    wall_elapsed = time.monotonic() - wall_start
    finished_at = datetime.now(UTC)

    throughput = successful / wall_elapsed if wall_elapsed > 0 else 0.0
    projected_seconds = (full_dataset_size / throughput) if throughput > 0 else 0.0

    per_stage_stats = {stage: compute_latency_stats(vals) for stage, vals in per_stage.items()}

    return PipelineBenchmarkResult(
        sample_size=sample_size,
        concurrency=concurrency,
        successful=successful,
        failed=failed,
        success_rate=(successful / sample_size) if sample_size else 0.0,
        latency=compute_latency_stats(latencies),
        throughput_tps=LabeledFloat(value=throughput, source=ResultSource.MEASURED),
        per_stage_latency_ms=per_stage_stats,
        full_dataset_size=full_dataset_size,
        full_dataset_projected_seconds=LabeledFloat(
            value=projected_seconds,
            source=ResultSource.PROJECTED,
            note=(
                f"Extrapolated from measured throughput ({throughput:.2f} tx/s) over "
                f"{sample_size} real sampled transactions - not a live full-dataset run."
            ),
        ),
        failures=failures[:50],
        tokens=tokens,
        started_at=started_at,
        finished_at=finished_at,
    )
