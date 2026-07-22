import asyncio
import uuid
from datetime import UTC, datetime

from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.domain.entities import (
    DatabaseMetrics,
    TableStorageMetric,
    TokenAuditEvent,
    TokenRegistryEntry,
    TokenStage,
    TokenStageResult,
    TokenStageStatus,
)
from app.domain.ports import TokenRepository
from app.infra.db.models import TokenAuditEventModel, TokenRegistryModel, TokenStageResultModel

_STAGE_COLUMN = {
    TokenStage.BEHAVIORAL: "behavioral_status",
    TokenStage.GRAPH: "graph_status",
    TokenStage.TRUST: "trust_status",
    TokenStage.COMPLIANCE: "compliance_status",
    TokenStage.DECISION: "decision_status",
}

_DB_STATUS_CHECK_TIMEOUT_SECONDS = 2.0


def _row_to_domain(row: TokenRegistryModel) -> TokenRegistryEntry:
    return TokenRegistryEntry(
        transaction_id=row.transaction_id,
        customer_id=row.customer_id,
        account_id=row.account_id,
        receiver_account_id=row.receiver_account_id,
        amount=row.amount,
        transaction_type=row.transaction_type,
        created_at=row.created_at,
        behavioral_status=row.behavioral_status,
        graph_status=row.graph_status,
        trust_status=row.trust_status,
        compliance_status=row.compliance_status,
        decision_status=row.decision_status,
    )


class PostgresTokenRepository(TokenRepository):
    """System of record for the Token Generation Station. Mirrors the shape of
    PostgresProfileRepository - session-factory-per-call, private row-mapping helpers,
    on_conflict_do_nothing for the idempotent create."""

    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._session_factory = session_factory

    async def get_by_transaction_id(self, transaction_id: str) -> TokenRegistryEntry | None:
        async with self._session_factory() as session:
            stmt = select(TokenRegistryModel).where(TokenRegistryModel.transaction_id == transaction_id)
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _row_to_domain(row) if row else None

    async def create_if_absent(self, entry: TokenRegistryEntry) -> tuple[TokenRegistryEntry, bool]:
        async with self._session_factory() as session:
            async with session.begin():
                stmt = (
                    pg_insert(TokenRegistryModel)
                    .values(
                        transaction_id=entry.transaction_id,
                        customer_id=entry.customer_id,
                        account_id=entry.account_id,
                        receiver_account_id=entry.receiver_account_id,
                        amount=entry.amount,
                        transaction_type=entry.transaction_type,
                        created_at=entry.created_at,
                        behavioral_status=entry.behavioral_status.value,
                        graph_status=entry.graph_status.value,
                        trust_status=entry.trust_status.value,
                        compliance_status=entry.compliance_status.value,
                        decision_status=entry.decision_status.value,
                    )
                    .on_conflict_do_nothing(index_elements=["transaction_id"])
                    .returning(TokenRegistryModel)
                )
                row = (await session.execute(stmt)).scalar_one_or_none()
                if row is not None:
                    session.add(
                        TokenAuditEventModel(
                            id=str(uuid.uuid4()),
                            transaction_id=entry.transaction_id,
                            event="Token Created",
                            detail=None,
                            occurred_at=entry.created_at,
                        )
                    )
                    return _row_to_domain(row), True

        existing = await self.get_by_transaction_id(entry.transaction_id)
        assert existing is not None, "on_conflict_do_nothing fired but no existing row found"
        return existing, False

    async def update_stage_status(
        self,
        transaction_id: str,
        stage: TokenStage,
        status: TokenStageStatus,
        event: str | None,
        detail: str | None,
        result: dict | None,
    ) -> TokenRegistryEntry:
        now = datetime.now(UTC)
        async with self._session_factory() as session:
            async with session.begin():
                column = _STAGE_COLUMN[stage]
                await session.execute(
                    update(TokenRegistryModel)
                    .where(TokenRegistryModel.transaction_id == transaction_id)
                    .values(**{column: status.value})
                )

                existing_result = (
                    await session.execute(
                        select(TokenStageResultModel).where(
                            TokenStageResultModel.transaction_id == transaction_id,
                            TokenStageResultModel.stage == stage.value,
                        )
                    )
                ).scalar_one_or_none()

                if existing_result is None:
                    session.add(
                        TokenStageResultModel(
                            id=str(uuid.uuid4()),
                            transaction_id=transaction_id,
                            stage=stage.value,
                            status=status.value,
                            result_json=result,
                            started_at=now if status == TokenStageStatus.RUNNING else None,
                            finished_at=now if status in (TokenStageStatus.COMPLETED, TokenStageStatus.FAILED) else None,
                        )
                    )
                else:
                    existing_result.status = status.value
                    if result is not None:
                        existing_result.result_json = result
                    if status == TokenStageStatus.RUNNING and existing_result.started_at is None:
                        existing_result.started_at = now
                    if status in (TokenStageStatus.COMPLETED, TokenStageStatus.FAILED):
                        existing_result.finished_at = now

                if event is not None:
                    session.add(
                        TokenAuditEventModel(
                            id=str(uuid.uuid4()),
                            transaction_id=transaction_id,
                            event=event,
                            detail=detail,
                            occurred_at=now,
                        )
                    )

        updated = await self.get_by_transaction_id(transaction_id)
        assert updated is not None, f"token {transaction_id} vanished during status update"
        return updated

    async def get_timeline(self, transaction_id: str) -> list[TokenAuditEvent]:
        async with self._session_factory() as session:
            stmt = (
                select(TokenAuditEventModel)
                .where(TokenAuditEventModel.transaction_id == transaction_id)
                .order_by(TokenAuditEventModel.occurred_at.asc())
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [
                TokenAuditEvent(
                    transaction_id=r.transaction_id, event=r.event, detail=r.detail, occurred_at=r.occurred_at
                )
                for r in rows
            ]

    async def get_stage_results(self, transaction_id: str) -> list[TokenStageResult]:
        async with self._session_factory() as session:
            stmt = select(TokenStageResultModel).where(TokenStageResultModel.transaction_id == transaction_id)
            rows = (await session.execute(stmt)).scalars().all()
            return [
                TokenStageResult(
                    transaction_id=r.transaction_id,
                    stage=r.stage,
                    status=r.status,
                    result=r.result_json,
                    started_at=r.started_at,
                    finished_at=r.finished_at,
                )
                for r in rows
            ]

    async def is_database_online(self) -> bool:
        try:
            async with self._session_factory() as session:
                await asyncio.wait_for(session.execute(select(1)), timeout=_DB_STATUS_CHECK_TIMEOUT_SECONDS)
            return True
        except Exception:
            return False

    async def get_database_metrics(self) -> DatabaseMetrics:
        async with self._session_factory() as session:
            db_size = (await session.execute(text("SELECT pg_database_size(current_database())"))).scalar_one()

            table_names = ["token_registry", "token_audit_events", "token_stage_results"]
            tables = []
            for name in table_names:
                row = (
                    await session.execute(
                        text(
                            "SELECT count(*) AS row_count, pg_total_relation_size(:name) AS size_bytes "
                            f"FROM {name}"
                        ),
                        {"name": name},
                    )
                ).one()
                tables.append(TableStorageMetric(table_name=name, row_count=row.row_count, size_bytes=row.size_bytes))

            return DatabaseMetrics(database_size_bytes=db_size, tables=tables)
