from __future__ import annotations

import enum
from datetime import datetime

from pydantic import BaseModel, Field, computed_field


class OwnershipRole(str, enum.Enum):
    OWNER = "owner"
    JOINT = "joint"
    AUTHORIZED_USER = "authorized_user"


class Customer(BaseModel):
    customer_id: str
    display_ref: str | None = None
    created_at: datetime


class Account(BaseModel):
    account_id: str
    product_type: str = "TRANSACTION_ACCOUNT"
    opened_at: datetime | None = None


class CustomerAccountLink(BaseModel):
    customer_id: str
    account_id: str
    role: OwnershipRole = OwnershipRole.OWNER
    linked_at: datetime


class TransactionEvent(BaseModel):
    tx_id: str
    sender_account_id: str
    receiver_account_id: str
    tx_type: str
    amount: float
    occurred_at: datetime
    raw_timestamp_step: int | None = None


class FeatureValue(BaseModel):
    name: str
    value: float
    group: str


class DnaVectorEntry(BaseModel):
    """Streaming statistic for one behavioral feature (Welford's online algorithm state).

    `m2` is internal accumulator state - meaningful only to someone who knows
    Welford's algorithm, and would silently stop meaning anything if Agent 1 ever
    switches to a different streaming-stats approach (EWMA, windowed, etc). It's
    kept for Agent 1's own incremental updates, but `variance`/`stddev` are
    `computed_field`s so downstream consumers (Agent 2, anyone reading the Kafka
    payload) get the derived, implementation-independent values directly instead
    of having to reimplement Welford's math themselves.
    """

    feature: str
    group: str
    count: int
    mean: float
    m2: float

    @computed_field  # type: ignore[prop-decorator]
    @property
    def variance(self) -> float:
        return self.m2 / self.count if self.count > 1 else 0.0

    @computed_field  # type: ignore[prop-decorator]
    @property
    def stddev(self) -> float:
        return self.variance**0.5


class ChangedFeature(BaseModel):
    feature: str
    group: str
    baseline_mean: float
    baseline_stddev: float
    observed: float
    z_score: float
    deviation_level: str


class BehavioralDnaProfile(BaseModel):
    """One immutable version of a customer's Behavioral DNA.

    A profile is never mutated in place: an update always produces a new row with
    version = previous.version + 1, and the previous row is superseded (is_current
    flips to False) but its content is retained forever for audit / investigation.
    """

    profile_id: str
    customer_id: str
    version: int
    dna_vector: list[DnaVectorEntry]
    trusted_beneficiaries: dict[str, int] = Field(default_factory=dict)
    history_depth: int
    source_tx_id: str | None = None  # transaction that produced this version - audit traceability only
    behavioral_risk_score: float | None = None
    confidence_score: float
    similarity_score: float | None = None
    changed_features: list[ChangedFeature] = Field(default_factory=list)
    explanation: str | None = None
    prev_version_hash: str | None = None
    content_hash: str
    is_current: bool
    valid_from: datetime
    valid_to: datetime | None = None
    schema_version: str = "1.0"


class AccountBehavioralContext(BaseModel):
    """Account-level behavioral context, subordinate to the customer-level DNA.

    The customer is the primary owner of Behavioral DNA (a customer may hold many
    accounts/cards/products); this tracks behavior specific to one account when a
    downstream agent needs account-scoped rather than customer-scoped context.
    """

    context_id: str
    account_id: str
    customer_id: str
    version: int
    dna_vector: list[DnaVectorEntry]
    history_depth: int
    source_tx_id: str | None = None
    is_current: bool
    valid_from: datetime
    valid_to: datetime | None = None


class DnaOutput(BaseModel):
    """Structured object Agent 1 publishes downstream - the STABLE CONTRACT for
    every other SAQR agent (Knowledge Graph Builder first). Consumers must only
    ever depend on this shape, never on Agent 1's internal storage models
    (BehavioralDnaProfile, the Postgres schema, etc) - those can change freely as
    long as this contract's fields and meaning stay stable across schema_version.

    Contains behavioral intelligence only - no fraud/AML verdict, no decision.
    """

    transaction_id: str
    customer_id: str
    account_id: str  # the transaction's sender/initiating account
    receiver_account_id: str
    profile_version: int
    behavioral_risk_score: float
    confidence_score: float
    similarity_score: float
    behavioral_dna_vector: list[DnaVectorEntry]
    changed_features: list[ChangedFeature]
    explanation: str
    occurred_at: datetime  # when the transaction actually happened
    generated_at: datetime  # when Agent 1 computed this output (processing time, not event time)
    schema_version: str = "1.0"


class TokenStage(str, enum.Enum):
    """The 5 pipeline stages the dashboard tracks per token. Order matters - this is
    the sequence a demo run executes in."""

    BEHAVIORAL = "behavioral"
    GRAPH = "graph"
    TRUST = "trust"
    COMPLIANCE = "compliance"
    DECISION = "decision"


class TokenStageStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TokenRegistryEntry(BaseModel):
    """The master registry row for one SAQR token. The token IS the transaction_id used
    everywhere in SAQR - Agents 2-5 never see a separate 'token' field, only this same
    transaction_id they already require. One row per transaction, created exactly once
    (see TokenStationService.get_or_create_token) and only ever updated on its 5 status
    columns thereafter."""

    transaction_id: str  # the SAQR token itself, e.g. "SAQR-TX-7F91D2A4"
    customer_id: str
    account_id: str
    receiver_account_id: str
    amount: float
    transaction_type: str
    created_at: datetime
    behavioral_status: TokenStageStatus = TokenStageStatus.PENDING
    graph_status: TokenStageStatus = TokenStageStatus.PENDING
    trust_status: TokenStageStatus = TokenStageStatus.PENDING
    compliance_status: TokenStageStatus = TokenStageStatus.PENDING
    decision_status: TokenStageStatus = TokenStageStatus.PENDING


class TokenAuditEvent(BaseModel):
    """One immutable row in the token's processing history. Never updated or deleted -
    the dashboard timeline renders exactly this table, in order, nothing synthesized."""

    transaction_id: str
    event: str
    detail: str | None = None
    occurred_at: datetime


class TokenStageResult(BaseModel):
    """The real response payload captured from whichever agent ran this stage - what
    powers the Token Details Page's 'full evidence from each agent' view."""

    transaction_id: str
    stage: TokenStage
    status: TokenStageStatus
    result: dict | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class TableStorageMetric(BaseModel):
    table_name: str
    row_count: int
    size_bytes: int


class DatabaseMetrics(BaseModel):
    """Real pg_database_size/pg_total_relation_size readings - the honest source of
    truth for the benchmark suite's Database Performance and Infrastructure Cost
    sections. Never estimated - if this can't be queried, the caller gets an error, not
    a placeholder number."""

    database_size_bytes: int
    tables: list[TableStorageMetric]
