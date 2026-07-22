from __future__ import annotations

import enum
from datetime import datetime

from pydantic import BaseModel


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Decision(str, enum.Enum):
    APPROVE = "APPROVE"
    REVIEW = "REVIEW"
    ESCALATE = "ESCALATE"
    REJECT = "REJECT"


class EvidenceSource(str, enum.Enum):
    BEHAVIORAL = "behavioral"
    GRAPH = "graph"
    TRUST = "trust"
    COMPLIANCE = "compliance"


class DecisionRequest(BaseModel):
    transaction_id: str
    customer_id: str
    account_id: str
    receiver_account_id: str
    amount: float
    occurred_at: datetime
    tx_type: str


class BehavioralSnapshot(BaseModel):
    """Subset of Agent 1's ProfileResponse this agent uses. Read-only - never
    calls Agent 1's POST /transactions/score, which advances the profile
    version; a downstream decision layer must not mutate upstream state."""

    customer_id: str
    behavioral_risk_score: float | None
    confidence_score: float
    history_depth: int


class GraphSnapshot(BaseModel):
    """Subset of Agent 2's GraphIntelligenceOutput this agent uses. Agent 2
    never computes a risk score by design - structural_complexity_score is
    the closest available proxy (same choice Agent 4 made)."""

    entity_id: str
    structural_complexity_score: float
    graph_confidence_score: float
    community_id: str | None
    community_size: int | None
    anomaly_descriptions: list[str]


class TrustSnapshot(BaseModel):
    """Subset of Agent 3's TrustIntelligenceOutput this agent uses."""

    trust_score: float
    confidence_level: float
    dominant_positive_factors: list[str]
    dominant_negative_factors: list[str]


class ComplianceSnapshot(BaseModel):
    """Subset of Agent 4's ComplianceAssessmentOutput this agent uses.
    compliance_status already encodes severity: 'non_compliant' means at
    least one BLOCKING rule was violated - that is the override signal."""

    compliance_status: str
    compliance_score: float
    compliance_confidence: float
    violated_rules: list[str]
    regulatory_findings: list[str]


class EvidenceContribution(BaseModel):
    source: EvidenceSource
    available: bool
    risk_value: float | None
    confidence: float | None
    weight: float
    contribution: float


class DecisionOutput(BaseModel):
    """Stable contract - the final, auditable output of the SAQR pipeline.
    Generates no new intelligence; every field here is derived from Agent
    1-4's own outputs, never invented."""

    transaction_id: str
    customer_id: str
    decision: Decision
    risk_level: RiskLevel
    overall_risk_score: float
    decision_confidence: float
    reasoning: str
    contributing_agents: list[str]
    positive_factors: list[str]
    negative_factors: list[str]
    evidence_breakdown: list[EvidenceContribution]
    generated_at: datetime
    schema_version: str = "1.0"
