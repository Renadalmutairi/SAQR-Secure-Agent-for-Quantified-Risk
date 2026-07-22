import asyncio
from datetime import UTC, datetime

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

_STAGE_ATTR = {
    TokenStage.BEHAVIORAL: "behavioral_status",
    TokenStage.GRAPH: "graph_status",
    TokenStage.TRUST: "trust_status",
    TokenStage.COMPLIANCE: "compliance_status",
    TokenStage.DECISION: "decision_status",
}


class InMemoryTokenRepository(TokenRepository):
    """Test double mirroring PostgresTokenRepository's real semantics (idempotent
    create, atomic status+result+audit updates) without a database - used by
    TokenStationService's unit tests and can double as a lightweight lock-free store for
    local/dev runs without Postgres."""

    def __init__(self) -> None:
        self._registry: dict[str, TokenRegistryEntry] = {}
        self._audit: dict[str, list[TokenAuditEvent]] = {}
        self._results: dict[str, dict[TokenStage, TokenStageResult]] = {}
        self._lock = asyncio.Lock()
        self.online = True  # tests can flip this to simulate the database going offline

    async def get_by_transaction_id(self, transaction_id: str) -> TokenRegistryEntry | None:
        return self._registry.get(transaction_id)

    async def create_if_absent(self, entry: TokenRegistryEntry) -> tuple[TokenRegistryEntry, bool]:
        async with self._lock:
            existing = self._registry.get(entry.transaction_id)
            if existing is not None:
                return existing, False
            self._registry[entry.transaction_id] = entry
            self._audit.setdefault(entry.transaction_id, []).append(
                TokenAuditEvent(
                    transaction_id=entry.transaction_id, event="Token Created", detail=None, occurred_at=entry.created_at
                )
            )
            return entry, True

    async def update_stage_status(
        self,
        transaction_id: str,
        stage: TokenStage,
        status: TokenStageStatus,
        event: str | None,
        detail: str | None,
        result: dict | None,
    ) -> TokenRegistryEntry:
        async with self._lock:
            current = self._registry[transaction_id]
            updated = current.model_copy(update={_STAGE_ATTR[stage]: status})
            self._registry[transaction_id] = updated

            now = datetime.now(UTC)
            existing_result = self._results.setdefault(transaction_id, {}).get(stage)

            started_at = existing_result.started_at if existing_result else None
            if status == TokenStageStatus.RUNNING and started_at is None:
                started_at = now
            finished_at = existing_result.finished_at if existing_result else None
            if status in (TokenStageStatus.COMPLETED, TokenStageStatus.FAILED):
                finished_at = now

            self._results[transaction_id][stage] = TokenStageResult(
                transaction_id=transaction_id,
                stage=stage,
                status=status,
                result=result if result is not None else (existing_result.result if existing_result else None),
                started_at=started_at,
                finished_at=finished_at,
            )

            if event is not None:
                self._audit.setdefault(transaction_id, []).append(
                    TokenAuditEvent(transaction_id=transaction_id, event=event, detail=detail, occurred_at=now)
                )
            return updated

    async def get_timeline(self, transaction_id: str) -> list[TokenAuditEvent]:
        return list(self._audit.get(transaction_id, []))

    async def get_stage_results(self, transaction_id: str) -> list[TokenStageResult]:
        return list(self._results.get(transaction_id, {}).values())

    async def is_database_online(self) -> bool:
        return self.online

    async def get_database_metrics(self) -> DatabaseMetrics:
        tables = [
            TableStorageMetric(table_name="token_registry", row_count=len(self._registry), size_bytes=0),
            TableStorageMetric(
                table_name="token_audit_events", row_count=sum(len(v) for v in self._audit.values()), size_bytes=0
            ),
            TableStorageMetric(
                table_name="token_stage_results", row_count=sum(len(v) for v in self._results.values()), size_bytes=0
            ),
        ]
        return DatabaseMetrics(database_size_bytes=0, tables=tables)
