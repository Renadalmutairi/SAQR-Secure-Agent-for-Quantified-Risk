from datetime import datetime

from pydantic import BaseModel

from app.domain.entities import ChangedFeature, DnaVectorEntry, TokenStage, TokenStageStatus


class TransactionEventRequest(BaseModel):
    tx_id: str
    sender_account_id: str
    receiver_account_id: str
    tx_type: str
    amount: float
    occurred_at: datetime
    raw_timestamp_step: int | None = None


class DnaOutputResponse(BaseModel):
    """Mirrors DnaOutput field-for-field - the REST and Kafka contracts must never
    drift apart. If you add a field to DnaOutput, add it here too: constructing
    this from `DnaOutput.model_dump()` silently drops any field not declared here
    (pydantic's default extra="ignore"), so a forgotten field here fails silently
    rather than with an error.
    """

    transaction_id: str
    customer_id: str
    account_id: str
    receiver_account_id: str
    profile_version: int
    behavioral_risk_score: float
    confidence_score: float
    similarity_score: float
    behavioral_dna_vector: list[DnaVectorEntry]
    changed_features: list[ChangedFeature]
    explanation: str
    occurred_at: datetime
    generated_at: datetime
    schema_version: str
    saqr_token: str


class ProfileResponse(BaseModel):
    customer_id: str
    version: int
    dna_vector: list[DnaVectorEntry]
    history_depth: int
    confidence_score: float
    behavioral_risk_score: float | None
    is_current: bool
    valid_from: datetime
    valid_to: datetime | None
    content_hash: str
    prev_version_hash: str | None


class AccountContextResponse(BaseModel):
    account_id: str
    customer_id: str
    version: int
    dna_vector: list[DnaVectorEntry]
    history_depth: int
    is_current: bool
    valid_from: datetime


class BackfillStartedResponse(BaseModel):
    run_id: str
    status: str
    message: str


class BackfillStatusResponse(BaseModel):
    run_id: str
    status: str
    rows_processed: int
    elapsed_seconds: float
    overall_tx_per_sec: float
    recent_tx_per_sec: float
    memory_rss_mb: float | None


class AuditVerificationResponse(BaseModel):
    customer_id: str
    chain_intact: bool


class TokenGenerateRequest(BaseModel):
    """POST /tokens/generate - the demo's entry point. No transaction_id: Agent 1 mints
    a brand new SAQR-TX-XXXXXXXX. customer_id is optional - resolved from account_id via
    the same CustomerAccountRepository the real scoring flow uses, if omitted."""

    account_id: str
    receiver_account_id: str
    amount: float
    transaction_type: str
    customer_id: str | None = None


class TokenRegistryResponse(BaseModel):
    transaction_id: str
    customer_id: str
    account_id: str
    receiver_account_id: str
    amount: float
    transaction_type: str
    created_at: datetime
    behavioral_status: TokenStageStatus
    graph_status: TokenStageStatus
    trust_status: TokenStageStatus
    compliance_status: TokenStageStatus
    decision_status: TokenStageStatus


class TokenAuditEventResponse(BaseModel):
    event: str
    detail: str | None
    occurred_at: datetime


class TokenStageResultResponse(BaseModel):
    stage: TokenStage
    status: TokenStageStatus
    result: dict | None
    started_at: datetime | None
    finished_at: datetime | None


class TokenDetailResponse(BaseModel):
    registry: TokenRegistryResponse
    stage_results: list[TokenStageResultResponse]


class TokenStatusUpdateRequest(BaseModel):
    stage: TokenStage
    status: TokenStageStatus
    detail: str | None = None
    result: dict | None = None


class DatabaseStatusResponse(BaseModel):
    database: str  # "online" | "offline"


class TableStorageMetricResponse(BaseModel):
    table_name: str
    row_count: int
    size_bytes: int


class DatabaseMetricsResponse(BaseModel):
    database_size_bytes: int
    tables: list[TableStorageMetricResponse]
