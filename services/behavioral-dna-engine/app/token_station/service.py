from datetime import UTC, datetime

from app.domain.entities import (
    DatabaseMetrics,
    TokenAuditEvent,
    TokenRegistryEntry,
    TokenStage,
    TokenStageResult,
    TokenStageStatus,
)
from app.domain.ports import CustomerAccountRepository, TokenRepository
from app.token_station.generator import generate_token

_MAX_GENERATION_ATTEMPTS = 5

# The exact 10-event happy-path vocabulary the audit timeline uses. Decision has no
# "Started" event by design - only "Decision Generated" on completion. Failure events
# aren't part of that fixed list but are recorded for the same reason nothing here is
# allowed to hide real state: a stage that failed must be visible, not silently absent.
_STAGE_LABELS = {
    TokenStage.BEHAVIORAL: "Behavioral DNA",
    TokenStage.GRAPH: "Graph Analysis",
    TokenStage.TRUST: "Trust Evaluation",
    TokenStage.COMPLIANCE: "Compliance",
    TokenStage.DECISION: "Decision",
}


def _event_text(stage: TokenStage, status: TokenStageStatus) -> str | None:
    label = _STAGE_LABELS[stage]
    if status == TokenStageStatus.RUNNING:
        return None if stage == TokenStage.DECISION else f"{label} Started"
    if status == TokenStageStatus.COMPLETED:
        return "Decision Generated" if stage == TokenStage.DECISION else f"{label} Finished"
    if status == TokenStageStatus.FAILED:
        return f"{label} Failed"
    return None


class TokenStationService:
    """The Token Generation Station. Owns the one place a SAQR token is minted,
    registered, and status-tracked. Never fabricates state - every method here either
    reads or writes a real Postgres row via TokenRepository."""

    def __init__(self, repository: TokenRepository, customer_accounts: CustomerAccountRepository) -> None:
        self._repository = repository
        self._customer_accounts = customer_accounts

    async def get_or_create_token(
        self,
        *,
        transaction_id: str | None,
        account_id: str,
        receiver_account_id: str,
        amount: float,
        transaction_type: str,
        customer_id: str | None = None,
    ) -> TokenRegistryEntry:
        """Two callers, two behaviors:
        - transaction_id given (POST /transactions/score, which already has its own
          tx_id): pure idempotent get-or-register using that value as the token.
        - transaction_id omitted (POST /tokens/generate, the demo's entry point): Agent 1
          mints a brand new SAQR-TX-XXXXXXXX and that becomes the transaction_id used
          everywhere downstream from here on.
        Never regenerates an existing transaction's token either way.
        """
        resolved_customer_id = customer_id
        if resolved_customer_id is None:
            customer = await self._customer_accounts.get_or_create_customer_for_account(account_id)
            resolved_customer_id = customer.customer_id

        if transaction_id is not None:
            existing = await self._repository.get_by_transaction_id(transaction_id)
            if existing is not None:
                return existing
            entry = TokenRegistryEntry(
                transaction_id=transaction_id,
                customer_id=resolved_customer_id,
                account_id=account_id,
                receiver_account_id=receiver_account_id,
                amount=amount,
                transaction_type=transaction_type,
                created_at=datetime.now(UTC),
            )
            row, _ = await self._repository.create_if_absent(entry)
            return row

        for _ in range(_MAX_GENERATION_ATTEMPTS):
            candidate = generate_token()
            entry = TokenRegistryEntry(
                transaction_id=candidate,
                customer_id=resolved_customer_id,
                account_id=account_id,
                receiver_account_id=receiver_account_id,
                amount=amount,
                transaction_type=transaction_type,
                created_at=datetime.now(UTC),
            )
            row, created = await self._repository.create_if_absent(entry)
            if created:
                return row
            # candidate collided with an existing, different transaction's token
            # (~1-in-4.3-billion odds) - try again with a fresh random value.
        raise RuntimeError("failed to generate a unique SAQR token after several attempts")

    async def get_token(self, transaction_id: str) -> TokenRegistryEntry | None:
        return await self._repository.get_by_transaction_id(transaction_id)

    async def get_timeline(self, transaction_id: str) -> list[TokenAuditEvent]:
        return await self._repository.get_timeline(transaction_id)

    async def get_stage_results(self, transaction_id: str) -> list[TokenStageResult]:
        return await self._repository.get_stage_results(transaction_id)

    async def update_stage_status(
        self,
        transaction_id: str,
        stage: TokenStage,
        status: TokenStageStatus,
        detail: str | None = None,
        result: dict | None = None,
    ) -> TokenRegistryEntry:
        """Updates the stage's status column, upserts its result, and - if this
        (stage, status) pair has a defined audit event title - appends exactly one
        immutable timeline row. `detail` is free-text (e.g. an error message on
        failure), separate from the event title itself."""
        return await self._repository.update_stage_status(
            transaction_id=transaction_id,
            stage=stage,
            status=status,
            event=_event_text(stage, status),
            detail=detail,
            result=result,
        )

    async def is_database_online(self) -> bool:
        return await self._repository.is_database_online()

    async def get_database_metrics(self) -> DatabaseMetrics:
        return await self._repository.get_database_metrics()
