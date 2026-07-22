from datetime import UTC, datetime

import pytest

from app.domain.entities import (
    BehavioralSnapshot,
    ComplianceSnapshot,
    DecisionRequest,
    GraphSnapshot,
    TrustSnapshot,
)


@pytest.fixture
def request_() -> DecisionRequest:
    return DecisionRequest(
        transaction_id="tx-1",
        customer_id="cust-1",
        account_id="acct-1",
        receiver_account_id="acct-2",
        amount=15000.0,
        occurred_at=datetime.now(UTC),
        tx_type="TRANSFER",
    )


@pytest.fixture
def low_risk_behavioral() -> BehavioralSnapshot:
    return BehavioralSnapshot(customer_id="cust-1", behavioral_risk_score=0.1, confidence_score=0.9, history_depth=182)


@pytest.fixture
def high_risk_behavioral() -> BehavioralSnapshot:
    return BehavioralSnapshot(customer_id="cust-1", behavioral_risk_score=0.9, confidence_score=0.9, history_depth=182)


@pytest.fixture
def low_risk_graph() -> GraphSnapshot:
    return GraphSnapshot(
        entity_id="acct-1",
        structural_complexity_score=0.1,
        graph_confidence_score=1.0,
        community_id="c-1",
        community_size=5,
        anomaly_descriptions=[],
    )


@pytest.fixture
def high_risk_graph() -> GraphSnapshot:
    return GraphSnapshot(
        entity_id="acct-1",
        structural_complexity_score=0.9,
        graph_confidence_score=1.0,
        community_id="c-1",
        community_size=200,
        anomaly_descriptions=["unusually high fan-in detected"],
    )


@pytest.fixture
def zero_confidence_graph() -> GraphSnapshot:
    """What Agent 2 actually returns for an unknown account: HTTP 200, all
    zero values, graph_confidence_score=0.0 - not None."""
    return GraphSnapshot(
        entity_id="does-not-exist",
        structural_complexity_score=0.0,
        graph_confidence_score=0.0,
        community_id=None,
        community_size=None,
        anomaly_descriptions=[],
    )


@pytest.fixture
def high_trust() -> TrustSnapshot:
    return TrustSnapshot(
        trust_score=0.9, confidence_level=0.8, dominant_positive_factors=["behavioral_dna"], dominant_negative_factors=[]
    )


@pytest.fixture
def low_trust() -> TrustSnapshot:
    return TrustSnapshot(
        trust_score=0.1, confidence_level=0.8, dominant_positive_factors=[], dominant_negative_factors=["relationship_trust"]
    )


@pytest.fixture
def zero_confidence_trust() -> TrustSnapshot:
    return TrustSnapshot(trust_score=0.0, confidence_level=0.0, dominant_positive_factors=[], dominant_negative_factors=[])


@pytest.fixture
def clean_compliance() -> ComplianceSnapshot:
    return ComplianceSnapshot(
        compliance_status="compliant", compliance_score=1.0, compliance_confidence=0.5,
        violated_rules=[], regulatory_findings=[],
    )


@pytest.fixture
def review_compliance() -> ComplianceSnapshot:
    return ComplianceSnapshot(
        compliance_status="requires_review", compliance_score=0.5, compliance_confidence=0.5,
        violated_rules=["AML-CDD-002"], regulatory_findings=["VIOLATED [violation_if_missing] AML-CDD-002: ..."],
    )


@pytest.fixture
def blocking_compliance() -> ComplianceSnapshot:
    return ComplianceSnapshot(
        compliance_status="non_compliant", compliance_score=0.0, compliance_confidence=0.5,
        violated_rules=["AML-CDD-007"], regulatory_findings=["VIOLATED [blocking] AML-CDD-007: ..."],
    )
