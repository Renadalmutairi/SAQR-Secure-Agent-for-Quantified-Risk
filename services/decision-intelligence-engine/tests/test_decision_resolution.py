from app.domain.entities import Decision, RiskLevel
from app.fusion.config import RiskThresholds
from app.fusion.decision import classify_risk_level, resolve_decision

_THRESHOLDS = RiskThresholds(low=0.25, medium=0.50, high=0.75)


def test_classify_risk_level_boundaries():
    assert classify_risk_level(0.0, _THRESHOLDS) == RiskLevel.LOW
    assert classify_risk_level(0.24, _THRESHOLDS) == RiskLevel.LOW
    assert classify_risk_level(0.25, _THRESHOLDS) == RiskLevel.MEDIUM
    assert classify_risk_level(0.49, _THRESHOLDS) == RiskLevel.MEDIUM
    assert classify_risk_level(0.50, _THRESHOLDS) == RiskLevel.HIGH
    assert classify_risk_level(0.74, _THRESHOLDS) == RiskLevel.HIGH
    assert classify_risk_level(0.75, _THRESHOLDS) == RiskLevel.CRITICAL
    assert classify_risk_level(1.0, _THRESHOLDS) == RiskLevel.CRITICAL


def test_low_score_no_compliance_yields_approve():
    decision, risk_level, reason = resolve_decision(0.1, None, _THRESHOLDS)
    assert decision == Decision.APPROVE
    assert risk_level == RiskLevel.LOW
    assert reason is None


def test_blocking_compliance_overrides_low_score_to_reject(clean_compliance, blocking_compliance):
    decision, risk_level, reason = resolve_decision(0.05, blocking_compliance, _THRESHOLDS)
    assert decision == Decision.REJECT
    assert risk_level == RiskLevel.CRITICAL
    assert reason is not None


def test_review_compliance_floors_approve_at_review(review_compliance):
    decision, risk_level, reason = resolve_decision(0.05, review_compliance, _THRESHOLDS)
    assert decision == Decision.REVIEW
    assert risk_level == RiskLevel.LOW  # risk_level itself is unaffected - only decision is floored
    assert reason is not None


def test_review_compliance_does_not_downgrade_already_severe_decision(review_compliance):
    decision, risk_level, reason = resolve_decision(0.95, review_compliance, _THRESHOLDS)
    assert decision == Decision.REJECT
    assert risk_level == RiskLevel.CRITICAL
    assert reason is None  # compliance didn't need to intervene - the score alone already drove REJECT


def test_clean_compliance_never_downgrades_a_high_score(clean_compliance):
    decision, risk_level, reason = resolve_decision(0.9, clean_compliance, _THRESHOLDS)
    assert decision == Decision.REJECT
    assert risk_level == RiskLevel.CRITICAL
    assert reason is None
