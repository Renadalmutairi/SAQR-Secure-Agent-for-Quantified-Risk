from app.domain.entities import ComplianceSnapshot, Decision, RiskLevel
from app.fusion.config import RiskThresholds

_SEVERITY_ORDER = [Decision.APPROVE, Decision.REVIEW, Decision.ESCALATE, Decision.REJECT]

_RISK_LEVEL_TO_DECISION = {
    RiskLevel.LOW: Decision.APPROVE,
    RiskLevel.MEDIUM: Decision.REVIEW,
    RiskLevel.HIGH: Decision.ESCALATE,
    RiskLevel.CRITICAL: Decision.REJECT,
}


def classify_risk_level(overall_risk_score: float, thresholds: RiskThresholds) -> RiskLevel:
    if overall_risk_score < thresholds.low:
        return RiskLevel.LOW
    if overall_risk_score < thresholds.medium:
        return RiskLevel.MEDIUM
    if overall_risk_score < thresholds.high:
        return RiskLevel.HIGH
    return RiskLevel.CRITICAL


def _more_severe(a: Decision, b: Decision) -> Decision:
    return a if _SEVERITY_ORDER.index(a) >= _SEVERITY_ORDER.index(b) else b


def resolve_decision(
    overall_risk_score: float, compliance: ComplianceSnapshot | None, thresholds: RiskThresholds
) -> tuple[Decision, RiskLevel, str | None]:
    """Fuses the evidence-driven risk score with the compliance override.
    Compliance can only ever make the outcome MORE conservative, never less -
    a clean compliance check can't rescue a transaction the other evidence
    flags, and it never has to (there is no case here where compliance lowers
    severity). Returns (decision, risk_level, override_reason).
    """
    risk_level = classify_risk_level(overall_risk_score, thresholds)
    decision = _RISK_LEVEL_TO_DECISION[risk_level]

    if compliance is None:
        return decision, risk_level, None

    if compliance.compliance_status == "non_compliant":
        return (
            Decision.REJECT,
            RiskLevel.CRITICAL,
            "compliance status is non_compliant (a blocking regulatory rule was violated) - "
            "this overrides all other evidence, as required",
        )

    if compliance.compliance_status == "requires_review":
        floored = _more_severe(decision, Decision.REVIEW)
        reason = (
            "compliance status is requires_review (a non-blocking rule was violated) - "
            "decision floored at REVIEW regardless of other evidence"
            if floored != decision
            else None
        )
        return floored, risk_level, reason

    return decision, risk_level, None
