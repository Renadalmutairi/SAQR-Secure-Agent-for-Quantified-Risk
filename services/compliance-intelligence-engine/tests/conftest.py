from datetime import UTC, datetime

import pytest

from app.domain.entities import (
    BehavioralSnapshot,
    ComplianceEvaluationRequest,
    RuleCategory,
    RuleSeverity,
    StructuralSnapshot,
    TrustSnapshot,
)


@pytest.fixture
def request_() -> ComplianceEvaluationRequest:
    return ComplianceEvaluationRequest(
        transaction_id="tx-1",
        customer_id="cust-1",
        account_id="acct-1",
        receiver_account_id="acct-2",
        amount=15000.0,
        occurred_at=datetime.now(UTC),
        tx_type="wire_transfer",
    )


@pytest.fixture
def behavioral() -> BehavioralSnapshot:
    return BehavioralSnapshot(customer_id="cust-1", behavioral_risk_score=0.2, confidence_score=0.9, history_depth=42)


@pytest.fixture
def structural() -> StructuralSnapshot:
    return StructuralSnapshot(
        entity_id="acct-1",
        structural_complexity_score=0.3,
        graph_confidence_score=0.8,
        community_id="community-1",
        community_size=12,
        structural_anomaly_count=0,
    )


@pytest.fixture
def trust() -> TrustSnapshot:
    return TrustSnapshot(trust_score=0.75, confidence_level=0.6, missing_evidence_count=1)


@pytest.fixture
def zero_confidence_structural() -> StructuralSnapshot:
    """What Agent 2 actually returns for an unknown account: HTTP 200, all
    zero values, graph_confidence_score=0.0 - not None. Any evaluator that
    treats `structural is not None` as 'real data exists' is wrong."""
    return StructuralSnapshot(
        entity_id="does-not-exist",
        structural_complexity_score=0.0,
        graph_confidence_score=0.0,
        community_id=None,
        community_size=None,
        structural_anomaly_count=0,
    )


@pytest.fixture
def zero_confidence_trust() -> TrustSnapshot:
    """What Agent 3 actually returns when every evidence source is
    unavailable: a real TrustIntelligenceOutput, not None."""
    return TrustSnapshot(trust_score=0.0, confidence_level=0.0, missing_evidence_count=5)


def make_rule(rule_id: str, trigger: str, severity=RuleSeverity.VIOLATION_IF_MISSING, category=RuleCategory.AML):
    from app.domain.entities import PolicyRule

    return PolicyRule(
        rule_id=rule_id,
        category=category,
        title=f"Test rule {rule_id}",
        source_document="TEST",
        source_reference="n/a",
        description="test rule",
        trigger=trigger,
        severity=severity,
    )
