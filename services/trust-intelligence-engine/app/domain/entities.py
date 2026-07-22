from __future__ import annotations

import enum
from datetime import datetime

from pydantic import BaseModel


class EvidenceType(str, enum.Enum):
    BEHAVIORAL_DNA = "behavioral_dna"
    DEVICE_TRUST = "device_trust"
    GEOGRAPHIC_TRUST = "geographic_trust"
    RELATIONSHIP_TRUST = "relationship_trust"
    HISTORICAL_TRUST = "historical_trust"


class TrustEvaluationRequest(BaseModel):
    transaction_id: str
    customer_id: str
    account_id: str


class BehavioralProfileSnapshot(BaseModel):
    """Subset of Agent 1's ProfileResponse this agent actually uses."""

    customer_id: str
    behavioral_risk_score: float | None
    confidence_score: float
    history_depth: int
    version: int


class GraphOutputSnapshot(BaseModel):
    """Subset of Agent 2's GraphIntelligenceOutput this agent actually uses."""

    entity_id: str
    graph_confidence_score: float
    avg_outgoing_trust_score: float | None


class HistoricalSignals(BaseModel):
    """Whatever historical signals are actually available for one evaluation.

    All optional - HistoricalTrustEvidenceProvider computes gracefully from
    whichever are present. Only `history_depth` is wired in v1 (from Agent 1's
    profile); the rest are reserved extension points - same pattern as Agent 1's
    disabled FeatureGroups and Agent 2's reserved node types - so a real source
    for any of them can be added later without changing the provider's public
    interface or the fusion engine.
    """

    previous_trust_score: float | None = None
    previous_behavioral_score: float | None = None
    previous_structural_score: float | None = None
    history_depth: int | None = None
    consistency_trend: float | None = None


class Evidence(BaseModel):
    """`quality` is distinct from `confidence`: confidence is the SOURCE's own
    self-assessment of certainty (e.g. Agent 1's confidence_score, which
    reflects how much history backs its number). Quality is this evidence's
    fitness for use as judged from the OUTSIDE - freshness, completeness,
    provenance - independent of what the source itself claims. A provider with
    no real quality signal yet should leave this None; the normalizer defaults
    it to 1.0 (full quality) rather than penalizing providers that simply
    haven't wired a quality signal.
    """

    source: EvidenceType
    available: bool
    score: float | None = None
    confidence: float | None = None
    quality: float | None = None
    detail: str | None = None


class EvidenceContribution(BaseModel):
    source: EvidenceType
    available: bool
    score: float | None
    confidence: float | None
    quality: float | None
    weight: float
    contribution: float


class TrustIntelligenceOutput(BaseModel):
    """Stable contract for downstream agents (Decision Agent) - consumers must
    only depend on this shape, never reach into Agent 1/2 directly through here.
    """

    transaction_id: str
    customer_id: str
    account_id: str
    trust_score: float
    confidence_level: float
    evidence_breakdown: list[EvidenceContribution]
    dominant_positive_factors: list[str]
    dominant_negative_factors: list[str]
    missing_evidence: list[EvidenceType]
    explanation: str
    generated_at: datetime
    schema_version: str = "1.0"
