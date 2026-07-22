import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_container
from app.api.schemas import BackfillStartedResponse, BackfillStatusResponse
from app.wiring import Container

router = APIRouter(tags=["backfill"])
logger = logging.getLogger(__name__)


@router.post("/profiles/backfill", response_model=BackfillStartedResponse, status_code=202)
async def start_backfill(container: Container = Depends(get_container)) -> BackfillStartedResponse:
    """Starts the production backfill pipeline as a background task and returns
    immediately - a synchronous HTTP request blocking until millions of rows
    finish isn't a viable contract. Poll GET /profiles/backfill/{run_id}/status.

    If a previous run for this CSV path is still marked "running" or "failed" in
    the checkpoint table, the pipeline resumes it automatically instead of
    starting over (see BackfillPipeline._resume_or_start).
    """
    run_id = str(uuid.uuid4())
    pipeline = container.new_backfill_pipeline(run_id, container.settings.transactions_csv_path)

    async def _run() -> None:
        try:
            await pipeline.run()
        except Exception:
            logger.exception("backfill run %s crashed", run_id)

    asyncio.create_task(_run())

    return BackfillStartedResponse(
        run_id=run_id,
        status="started",
        message="Backfill started in the background. Poll GET /profiles/backfill/{run_id}/status for progress.",
    )


@router.get("/profiles/backfill/{run_id}/status", response_model=BackfillStatusResponse)
async def get_backfill_status(run_id: str, container: Container = Depends(get_container)) -> BackfillStatusResponse:
    pipeline = container.active_backfills.get(run_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Unknown backfill run_id (or the service restarted since it ran)")

    snapshot = pipeline.progress.snapshot()
    return BackfillStatusResponse(
        run_id=snapshot.run_id,
        status=snapshot.status,
        rows_processed=snapshot.rows_processed,
        elapsed_seconds=snapshot.elapsed_seconds,
        overall_tx_per_sec=snapshot.overall_tx_per_sec,
        recent_tx_per_sec=snapshot.recent_tx_per_sec,
        memory_rss_mb=snapshot.memory_rss_mb,
    )
