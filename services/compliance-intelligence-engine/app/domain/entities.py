from __future__ import annotations

import enum
from datetime import datetime

from pydantic import BaseModel


class RuleSeverity(str, enum.Enum):
    BLOCKING = "blocking"
    VIOLATION_IF_MISSING = "violation_if_missing"
    INFORMATIONAL = "informational"


class RuleCategory(str, enum.Enum):
    AML = "AML"
    KYC_CDD = "KYC_CDD"
    TRANSACTION_MONITORING = "TRANSACTION_MONITORING"
    SANCTIONS_SCREENING = "SANCTIONS_SCREENING"
    INTERNAL_GOVERNANCE = "INTERNAL_GOVERNANCE"
    REPORTING_OBLIGATIONS = "REPORTING_OBLIGATIONS"
    REGULATORY_THRESHOLDS = "REGULATORY_THRESHOLDS"
    OTHER = "OTHER"


class EvaluationScope(str, enum.Enum):
    PER_TRANSACTION = "per_transaction"
    INSTITUTIONAL = "institutional"  # cannot be honestly evaluated against a single transaction


class PolicyRule(BaseModel):
    """One rule from the Policy Registry (compliance_policies/registry/*.yaml).
    Every field here mirrors what's in the YAML - the registry is the source
    of truth, this is just its typed in-memory shape."""

    rule_id: str
    category: RuleCategory
    title: str
    source_document: str
    source_reference: str
    description: str
    trigger: str
    severity: RuleSeverity
    threshold: dict | None = None
    evaluation_scope: EvaluationScope = EvaluationScope.PER_TRANSACTION
    confidence: str | None = None


class RuleVerdictStatus(str, enum.Enum):
    PASSED = "passed"
    VIOLATED = "violated"
    UNEVALUATED = "unevaluated"


class RuleVerdict(BaseModel):
    rule_id: str
    category: RuleCategory
    severity: RuleSeverity
    status: RuleVerdictStatus
    reason: str


class ComplianceEvaluationRequest(BaseModel):
    transaction_id: str
    customer_id: str
    account_id: str
    receiver_account_id: str
    amount: float
    occurred_at: datetime
    tx_type: str


class BehavioralSnapshot(BaseModel):
    """Subset of Agent 1's ProfileResponse this agent uses."""

    customer_id: str
    behavioral_risk_score: float | None
    confidence_score: float
    history_depth: int


class StructuralSnapshot(BaseModel):
    """Subset of Agent 2's GraphIntelligenceOutput this agent uses. Agent 2
    deliberately never computes a 'risk' score (it reports structural
    observations only) - structural_complexity_score is the closest proxy."""

    entity_id: str
    structural_complexity_score: float
    graph_confidence_score: float
    community_id: str | None
    community_size: int | None
    structural_anomaly_count: int


class TrustSnapshot(BaseModel):
    """Subset of Agent 3's TrustIntelligenceOutput this agent uses."""

    trust_score: float
    confidence_level: float
    missing_evidence_count: int


class CustomerProfileSnapshot(BaseModel):
    """Does not exist anywhere in SAQR yet - always unavailable via the mock
    provider until a real KYC/customer-master system is integrated. Defined
    now so rules that need it (e.g. PEP status) have a well-typed shape ready."""

    customer_id: str
    risk_category: str | None = None
    verification_status: str | None = None
    account_status: str | None = None
    is_pep: bool | None = None
    customer_type: str | None = None  # "natural_person" | "legal_person"


class CategoryAssessment(BaseModel):
    passed: int
    violated: int
    unevaluated: int
    score: float | None  # None if nothing in this category could be evaluated


class ComplianceAssessmentOutput(BaseModel):
    """Stable contract for downstream agents (Decision Agent) - consumers must
    only depend on this shape, never reach into Agent 1/2/3 or the Policy
    Registry directly through here."""

    transaction_id: str
    customer_id: str
    compliance_score: float
    compliance_status: str
    compliance_confidence: float
    aml_assessment: CategoryAssessment
    kyc_assessment: CategoryAssessment
    policy_assessment: CategoryAssessment
    violated_rules: list[str]
    passed_rules: list[str]
    unevaluated_rules: list[str]
    compliance_explanation: list[str]
    generated_at: datetime
    schema_version: str = "1.0"
