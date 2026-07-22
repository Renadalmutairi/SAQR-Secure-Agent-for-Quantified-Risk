import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.routes import get_container
from app.benchmark.dataset import count_real_transactions
from app.benchmark.db_benchmark import run_db_benchmark
from app.benchmark.infra_cost import compute_infra_cost
from app.benchmark.jobs import Job
from app.benchmark.models import (
    BenchmarkReport,
    DbBenchmarkResult,
    PipelineBenchmarkResult,
    TokenBenchmarkResult,
    TraceabilityResult,
)
from app.benchmark.pipeline_benchmark import run_pipeline_benchmark
from app.benchmark.readiness import check_production_readiness
from app.benchmark.token_benchmark import run_token_benchmark
from app.benchmark.traceability import run_traceability_check
from app.wiring import Container

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])


class PipelineRunRequest(BaseModel):
    sample_size: int | None = None
    concurrency: int | None = None


class TokenRunRequest(BaseModel):
    total: int | None = None
    customer_count: int | None = None
    concurrency: int | None = None


class DbRunRequest(BaseModel):
    sample_size: int | None = None


def _job_view(job: Job) -> dict:
    return {
        "job_id": job.job_id,
        "kind": job.kind,
        "status": job.status,
        "progress": job.progress,
        "result": job.result,
        "error": job.error,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


@router.post("/pipeline/run")
async def start_pipeline_benchmark(
    body: PipelineRunRequest, container: Container = Depends(get_container)
) -> dict:
    settings = container.settings
    sample_size = body.sample_size or settings.benchmark_pipeline_default_sample_size
    concurrency = body.concurrency or settings.benchmark_pipeline_default_concurrency

    job = container.jobs.create("pipeline")

    async def _run() -> None:
        try:
            full_size = count_real_transactions(settings.transactions_csv_path)
            result = await run_pipeline_benchmark(
                orchestrator=container.orchestrator,
                csv_path=settings.transactions_csv_path,
                full_dataset_size=full_size,
                sample_size=sample_size,
                concurrency=concurrency,
                progress_cb=lambda done, total: container.jobs.update_progress(job, {"completed": done, "total": total}),
            )
            await container.jobs.complete(job, result.model_dump(mode="json"))
        except Exception as exc:
            logger.exception("pipeline benchmark failed")
            await container.jobs.fail(job, str(exc))

    container.spawn(_run())
    return _job_view(job)


@router.post("/tokens/run")
async def start_token_benchmark(body: TokenRunRequest, container: Container = Depends(get_container)) -> dict:
    settings = container.settings
    total = body.total or settings.benchmark_token_default_total
    customer_count = body.customer_count or settings.benchmark_token_default_customers
    concurrency = body.concurrency or settings.benchmark_token_default_concurrency

    job = container.jobs.create("tokens")
    container.token_benchmark_outage.start = None
    container.token_benchmark_outage.end = None

    async def _run() -> None:
        try:
            result = await run_token_benchmark(
                client=container.http_client,
                base_url=settings.behavioral_dna_base_url,
                timeout=settings.upstream_timeout_seconds,
                total=total,
                customer_count=customer_count,
                concurrency=concurrency,
                job=job,
                job_store=container.jobs,
                outage=container.token_benchmark_outage,
                full_target_size=settings.benchmark_token_full_target_size,
            )
            await container.jobs.complete(job, result.model_dump(mode="json"))
        except Exception as exc:
            logger.exception("token benchmark failed")
            await container.jobs.fail(job, str(exc))

    container.spawn(_run())
    return _job_view(job)


@router.post("/tokens/outage/start")
async def mark_outage_start(container: Container = Depends(get_container)) -> dict:
    """Operator-triggered: call this right when you stop Postgres to inject a real
    resilience test into the currently running token benchmark. The dashboard never
    stops/starts Postgres itself - see the infra decision against granting any service
    Docker control."""
    container.token_benchmark_outage.mark_start()
    return {"marked_at": datetime.now(UTC).isoformat()}


@router.post("/tokens/outage/end")
async def mark_outage_end(container: Container = Depends(get_container)) -> dict:
    container.token_benchmark_outage.mark_end()
    return {"marked_at": datetime.now(UTC).isoformat()}


@router.post("/db/run")
async def start_db_benchmark(body: DbRunRequest, container: Container = Depends(get_container)) -> dict:
    settings = container.settings
    sample_size = body.sample_size or settings.benchmark_db_default_sample_size

    job = container.jobs.create("db")

    async def _run() -> None:
        try:
            result = await run_db_benchmark(
                client=container.http_client,
                base_url=settings.behavioral_dna_base_url,
                timeout=settings.upstream_timeout_seconds,
                sample_size=sample_size,
            )
            await container.jobs.complete(job, result.model_dump(mode="json"))
        except Exception as exc:
            logger.exception("db benchmark failed")
            await container.jobs.fail(job, str(exc))

    container.spawn(_run())
    return _job_view(job)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, container: Container = Depends(get_container)) -> dict:
    job = container.jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown benchmark job")
    return _job_view(job)


@router.get("/jobs/latest/{kind}")
async def get_latest_job(kind: str, container: Container = Depends(get_container)) -> dict:
    job = container.jobs.latest(kind)
    if job is None:
        raise HTTPException(status_code=404, detail=f"No {kind} benchmark has been run yet")
    return _job_view(job)


@router.get("/traceability")
async def get_traceability(container: Container = Depends(get_container)) -> dict:
    pipeline_job = container.jobs.latest("pipeline")
    if pipeline_job is None or pipeline_job.status != "completed" or pipeline_job.result is None:
        raise HTTPException(status_code=404, detail="Run Benchmark 1 (pipeline) first - traceability checks its tokens")

    tokens = pipeline_job.result.get("tokens", [])
    result = await run_traceability_check(
        client=container.http_client,
        base_url=container.settings.behavioral_dna_base_url,
        timeout=container.settings.upstream_timeout_seconds,
        tokens=tokens,
    )
    return result.model_dump(mode="json")


@router.get("/infrastructure")
async def get_infrastructure(container: Container = Depends(get_container)) -> dict:
    result = await compute_infra_cost(
        client=container.http_client,
        agent1_base_url=container.settings.behavioral_dna_base_url,
        timeout=container.settings.upstream_timeout_seconds,
        snapshot_path=container.settings.infra_snapshot_path,
    )
    return result.model_dump(mode="json")


@router.get("/readiness")
async def get_readiness(container: Container = Depends(get_container)) -> list[dict]:
    items = await check_production_readiness(container.http_client, container.settings)
    return [item.model_dump(mode="json") for item in items]


@router.get("/report", response_model=BenchmarkReport)
async def get_report(container: Container = Depends(get_container)) -> BenchmarkReport:
    """The combined Final Validation Report payload - pulls the latest completed
    result from each benchmark. Any benchmark not yet run comes back as null, never a
    fabricated placeholder."""
    settings = container.settings

    pipeline_job = container.jobs.latest("pipeline")
    pipeline_result = (
        PipelineBenchmarkResult(**pipeline_job.result)
        if pipeline_job and pipeline_job.status == "completed" and pipeline_job.result
        else None
    )

    tokens_job = container.jobs.latest("tokens")
    tokens_result = (
        TokenBenchmarkResult(**tokens_job.result)
        if tokens_job and tokens_job.status == "completed" and tokens_job.result
        else None
    )

    traceability_result: TraceabilityResult | None = None
    if pipeline_result is not None:
        traceability_result = await run_traceability_check(
            client=container.http_client,
            base_url=settings.behavioral_dna_base_url,
            timeout=settings.upstream_timeout_seconds,
            tokens=pipeline_result.tokens,
        )

    db_job = container.jobs.latest("db")
    db_result = (
        DbBenchmarkResult(**db_job.result) if db_job and db_job.status == "completed" and db_job.result else None
    )

    infra_result = await compute_infra_cost(
        client=container.http_client,
        agent1_base_url=settings.behavioral_dna_base_url,
        timeout=settings.upstream_timeout_seconds,
        snapshot_path=settings.infra_snapshot_path,
    )

    readiness_items = await check_production_readiness(container.http_client, settings)

    return BenchmarkReport(
        generated_at=datetime.now(UTC),
        pipeline=pipeline_result,
        tokens=tokens_result,
        traceability=traceability_result,
        database=db_result,
        infra_cost=infra_result,
        readiness=readiness_items,
    )
