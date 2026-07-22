from __future__ import annotations

import enum
from datetime import datetime

from pydantic import BaseModel


class RawTransactionEvent(BaseModel):
    """Mirrors Agent 1's TransactionEvent / the Ingestion Gateway's RawTransactionEvent
    field-for-field - all three describe the same wire shape independently, by
    design (no shared package yet - see project memory on that open question).
    Never carries IS_FRAUD/ALERT_ID.
    """

    tx_id: str
    sender_account_id: str
    receiver_account_id: str
    tx_type: str
    amount: float
    occurred_at: datetime
    raw_timestamp_step: int | None = None


class BehavioralAnnotation(BaseModel):
    """The fields of Agent 1's DnaOutput this agent actually consumes. Parsed
    independently from the Kafka JSON - Agent 2 never imports Agent 1's code or
    touches its Postgres tables, only this contract's wire shape."""

    transaction_id: str
    customer_id: str
    account_id: str
    receiver_account_id: str
    behavioral_risk_score: float
    confidence_score: float
    similarity_score: float
    profile_version: int
    occurred_at: datetime
    generated_at: datetime


class ReservedNodeType(str, enum.Enum):
    """Node types the spec calls for but no data source exists yet - defined now
    so enabling one later is a config/enricher change, not a schema redesign."""

    DEVICE = "Device"
    IP_ADDRESS = "IPAddress"
    MERCHANT = "Merchant"
    COMPANY = "Company"
    SESSION = "Session"
    COUNTRY = "Country"


class WelfordState(BaseModel):
    """Shared streaming-stats primitive - same shape as Agent 1's DnaVectorEntry,
    duplicated here rather than imported (separate deployable services)."""

    count: int = 0
    mean: float = 0.0
    m2: float = 0.0


class EdgeStoredProperties(BaseModel):
    """What actually gets written to a transfers_to edge. Split deliberately from
    EdgeDerivedMetrics: these are the only fields updated on every transaction -
    everything else (average, decay, trust score) is computed at read time so we
    never rewrite an edge just because time passed.
    """

    interaction_count: int = 0
    total_amount: float = 0.0
    first_seen: datetime | None = None
    last_seen: datetime | None = None

    # EWMA'd behavioral context from Agent 1, folded in per transaction on this edge
    behavioral_similarity_ewma: float | None = None
    behavioral_confidence_ewma: float | None = None
    behavioral_risk_ewma: float | None = None

    # streaming stats feeding the Structural Trust Score's temporal-consistency
    # and transaction-regularity components
    gap_seconds_stats: WelfordState = WelfordState()
    amount_log_stats: WelfordState = WelfordState()


class EdgeDerivedMetrics(BaseModel):
    """Computed at read time from EdgeStoredProperties + now. Never persisted."""

    average_amount: float
    relationship_age_seconds: float
    time_decay_weight: float
    temporal_consistency: float
    transaction_regularity: float
    structural_trust_score: float


class CustomerNodeSnapshot(BaseModel):
    """Node-level (long-term) behavioral state - overwritten per DnaOutput, NOT
    EWMA'd. Distinct on purpose from edge-level EWMA: lets the GNN tell apart a
    risky customer behaving normally on one relationship from a normal customer
    entering one risky relationship.
    """

    customer_id: str
    behavioral_risk_score: float
    confidence_score: float
    similarity_score: float
    profile_version: int
    behavioral_updated_at: datetime


class StructuralFeatures(BaseModel):
    degree: int
    weighted_degree: float
    fan_in: int
    fan_out: int
    clustering_coefficient: float
    shared_beneficiary_count: int
    community_id: str | None = None
    community_size: int | None = None
    pagerank: float | None = None
    betweenness: float | None = None
    eigenvector: float | None = None
    structural_complexity_score: float = 0.0


class StructuralAnomaly(BaseModel):
    """An observation, not a verdict - this agent never classifies fraud."""

    anomaly_type: str
    entity_id: str
    entity_type: str
    score: float
    description: str
    detected_at: datetime


class GraphIntelligenceOutput(BaseModel):
    """Stable contract for downstream agents (Trust Agent, GNN) - consumers must
    only depend on this shape, never on Neo4j internals or Cypher queries.
    """

    entity_id: str
    entity_type: str
    transaction_id: str | None = None
    graph_embedding: list[float] = []
    structural_features: StructuralFeatures
    community_id: str | None = None
    community_size: int | None = None
    neighborhood_stats: dict[str, float] = {}
    structural_anomalies: list[StructuralAnomaly] = []
    graph_confidence_score: float
    graph_metadata: dict[str, str] = {}
    generated_at: datetime
    schema_version: str = "1.0"
