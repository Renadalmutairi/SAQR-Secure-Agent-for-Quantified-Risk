from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models import BackfillCheckpointModel


class CheckpointStore:
    """Durable resume point for a backfill run. A checkpoint is only ever advanced
    in the SAME transaction as the batch of profile/context writes it covers, so a
    crash can never leave byte_offset pointing past uncommitted data.
    """

    async def get(self, session: AsyncSession, run_id: str) -> BackfillCheckpointModel | None:
        return await session.get(BackfillCheckpointModel, run_id)

    async def start(self, session: AsyncSession, run_id: str, csv_path: str) -> BackfillCheckpointModel:
        now = datetime.now(UTC)
        stmt = (
            pg_insert(BackfillCheckpointModel)
            .values(
                run_id=run_id, csv_path=csv_path, byte_offset=0, rows_processed=0,
                last_tx_id=None, status="running", started_at=now, updated_at=now,
            )
            .on_conflict_do_nothing(index_elements=["run_id"])
        )
        await session.execute(stmt)
        await session.flush()
        return await self.get(session, run_id)

    async def advance(
        self, session: AsyncSession, run_id: str, byte_offset: int, rows_processed_delta: int, last_tx_id: str | None
    ) -> None:
        checkpoint = await session.get(BackfillCheckpointModel, run_id)
        checkpoint.byte_offset = byte_offset
        checkpoint.rows_processed += rows_processed_delta
        checkpoint.last_tx_id = last_tx_id
        checkpoint.updated_at = datetime.now(UTC)

    async def mark_completed(self, session: AsyncSession, run_id: str) -> None:
        checkpoint = await session.get(BackfillCheckpointModel, run_id)
        checkpoint.status = "completed"
        checkpoint.updated_at = datetime.now(UTC)

    async def mark_failed(self, session: AsyncSession, run_id: str, error_message: str) -> None:
        checkpoint = await session.get(BackfillCheckpointModel, run_id)
        checkpoint.status = "failed"
        checkpoint.error_message = error_message[:2000]
        checkpoint.updated_at = datetime.now(UTC)

    async def latest_for_csv(self, session: AsyncSession, csv_path: str) -> BackfillCheckpointModel | None:
        stmt = (
            select(BackfillCheckpointModel)
            .where(BackfillCheckpointModel.csv_path == csv_path)
            .order_by(BackfillCheckpointModel.started_at.desc())
            .limit(1)
        )
        return (await session.execute(stmt)).scalar_one_or_none()
