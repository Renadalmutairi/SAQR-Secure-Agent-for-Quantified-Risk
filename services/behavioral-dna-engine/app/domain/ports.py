from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Awaitable

from app.domain.entities import (
    Account,
    AccountBehavioralContext,
    BehavioralDnaProfile,
    Customer,
    CustomerAccountLink,
    DatabaseMetrics,
    DnaOutput,
    TokenAuditEvent,
    TokenRegistryEntry,
    TokenStage,
    TokenStageResult,
    TokenStageStatus,
    TransactionEvent,
)


class TransactionSource(ABC):
    """Source-agnostic transaction feed. CSV batch file today, Kafka topic / CDC stream later."""

    @abstractmethod
    async def stream_historical(self) -> AsyncIterator[TransactionEvent]:
        """Yield every known transaction in chronological order, for batch baseline building."""

    @abstractmethod
    async def transactions_for_account(self, account_id: str) -> list[TransactionEvent]:
        """Return transactions where this account is the sender, chronological order."""


class CustomerAccountRepository(ABC):
    """Resolves the customer <-> account graph.

    One customer may own many accounts/cards/products (many-to-many via CustomerAccountLink).
    Never assume account_id == customer_id upstream of this port.
    """

    @abstractmethod
    async def get_or_create_customer_for_account(self, account_id: str) -> Customer: ...

    @abstractmethod
    async def accounts_for_customer(self, customer_id: str) -> list[Account]: ...

    @abstractmethod
    async def customer_for_account(self, account_id: str) -> Customer | None: ...

    @abstractmethod
    async def link(self, link: CustomerAccountLink) -> None: ...


class ProfileRepository(ABC):
    """Append-only store for versioned Behavioral DNA. Never overwrites a version's content."""

    @abstractmethod
    async def get_current(self, customer_id: str) -> BehavioralDnaProfile | None: ...

    @abstractmethod
    async def get_history(self, customer_id: str, limit: int = 100) -> list[BehavioralDnaProfile]: ...

    @abstractmethod
    async def append_version(self, profile: BehavioralDnaProfile) -> None:
        """Persist a new version as current; the prior current version is superseded, not deleted."""

    @abstractmethod
    async def get_current_account_context(self, account_id: str) -> AccountBehavioralContext | None: ...

    @abstractmethod
    async def append_account_context_version(self, context: AccountBehavioralContext) -> None: ...

    @abstractmethod
    async def verify_chain_integrity(self, customer_id: str) -> bool:
        """Recompute the hash chain across all stored versions; False if any version was altered."""


class Cache(ABC):
    """Low-latency lookup of the *current* profile only. Never the source of truth."""

    @abstractmethod
    async def get_current_profile(self, customer_id: str) -> BehavioralDnaProfile | None: ...

    @abstractmethod
    async def set_current_profile(self, profile: BehavioralDnaProfile) -> None: ...


class EventPublisher(ABC):
    """Emits structured DNA output for downstream SAQR agents to consume."""

    @abstractmethod
    async def publish_dna_output(self, output: DnaOutput) -> None:
        """Real-time path: publish and confirm delivery before returning."""

    @abstractmethod
    async def send_nowait(self, output: DnaOutput) -> Awaitable:
        """Bulk path: enqueue onto the producer's internal batching buffer (a
        cheap local operation, not a broker round trip) and return a Future for
        the eventual delivery ack. The caller collects these across a whole
        flush and awaits them together once (e.g. via asyncio.gather), instead
        of blocking on a broker ack per message - this is what makes
        high-throughput backfill possible.
        """


class TokenRepository(ABC):
    """System of record for the Token Generation Station. A token's registry row is
    created exactly once (enforced by a unique constraint on transaction_id, not just
    application logic) and only ever updated on its 5 status columns thereafter; audit
    events are append-only and never updated or deleted.
    """

    @abstractmethod
    async def get_by_transaction_id(self, transaction_id: str) -> TokenRegistryEntry | None: ...

    @abstractmethod
    async def create_if_absent(self, entry: TokenRegistryEntry) -> tuple[TokenRegistryEntry, bool]:
        """Idempotent: if a row for entry.transaction_id already exists, returns
        (EXISTING row, False) unchanged - never regenerates or overwrites it. Returns
        (new row, True) when this call actually created it. The bool lets a caller
        minting a random candidate token detect a genuine collision with a different,
        pre-existing transaction (vs. a deliberate get-or-create by known transaction_id,
        where an existing row is the expected success case)."""

    @abstractmethod
    async def update_stage_status(
        self,
        transaction_id: str,
        stage: TokenStage,
        status: TokenStageStatus,
        event: str | None,
        detail: str | None,
        result: dict | None,
    ) -> TokenRegistryEntry:
        """Atomically: updates the one status column for this stage, upserts the stage's
        result row, and - if `event` is not None - appends one audit event, all in a
        single transaction, so the registry and the timeline can never disagree."""

    @abstractmethod
    async def get_timeline(self, transaction_id: str) -> list[TokenAuditEvent]: ...

    @abstractmethod
    async def get_stage_results(self, transaction_id: str) -> list[TokenStageResult]: ...

    @abstractmethod
    async def is_database_online(self) -> bool:
        """A real SELECT 1, not a cached/assumed value - this is what the dashboard's
        Generate-button gating and auto re-enable are built on."""

    @abstractmethod
    async def get_database_metrics(self) -> DatabaseMetrics:
        """Real pg_database_size/pg_total_relation_size readings for the 3 token
        tables - the benchmark suite's Database Performance / Infrastructure Cost
        sections read this directly, never an estimate."""
