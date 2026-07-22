from datetime import UTC, datetime

from app.domain.entities import (
    CategoryAssessment,
    ComplianceAssessmentOutput,
    ComplianceEvaluationRequest,
    RuleCategory,
    RuleSeverity,
    RuleVerdict,
    RuleVerdictStatus,
)

_AML_CATEGORIES = {
    RuleCategory.AML,
    RuleCategory.TRANSACTION_MONITORING,
    RuleCategory.REPORTING_OBLIGATIONS,
    RuleCategory.REGULATORY_THRESHOLDS,
    RuleCategory.SANCTIONS_SCREENING,
}
_KYC_CATEGORIES = {RuleCategory.KYC_CDD}
_POLICY_CATEGORIES = {RuleCategory.INTERNAL_GOVERNANCE, RuleCategory.OTHER}


def _assess_bucket(verdicts: list[RuleVerdict]) -> CategoryAssessment:
    passed = sum(1 for v in verdicts if v.status == RuleVerdictStatus.PASSED)
    violated = sum(1 for v in verdicts if v.status == RuleVerdictStatus.VIOLATED)
    unevaluated = sum(1 for v in verdicts if v.status == RuleVerdictStatus.UNEVALUATED)
    evaluated = passed + violated
    score = (passed / evaluated) if evaluated > 0 else None
    return CategoryAssessment(passed=passed, violated=violated, unevaluated=unevaluated, score=score)


def build_compliance_output(
    request: ComplianceEvaluationRequest, verdicts: list[RuleVerdict]
) -> ComplianceAssessmentOutput:
    aml_assessment = _assess_bucket([v for v in verdicts if v.category in _AML_CATEGORIES])
    kyc_assessment = _assess_bucket([v for v in verdicts if v.category in _KYC_CATEGORIES])
    policy_assessment = _assess_bucket([v for v in verdicts if v.category in _POLICY_CATEGORIES])

    category_scores = [a.score for a in (aml_assessment, kyc_assessment, policy_assessment) if a.score is not None]
    base_score = sum(category_scores) / len(category_scores) if category_scores else 1.0

    blocking_violations = [
        v for v in verdicts if v.status == RuleVerdictStatus.VIOLATED and v.severity == RuleSeverity.BLOCKING
    ]
    non_blocking_violations = [
        v for v in verdicts if v.status == RuleVerdictStatus.VIOLATED and v.severity != RuleSeverity.BLOCKING
    ]

    if blocking_violations:
        compliance_score = 0.0
        compliance_status = "non_compliant"
    elif non_blocking_violations:
        compliance_score = base_score
        compliance_status = "requires_review"
    else:
        compliance_score = base_score
        compliance_status = "compliant"

    total_rules = len(verdicts)
    evaluated_total = sum(1 for v in verdicts if v.status != RuleVerdictStatus.UNEVALUATED)
    compliance_confidence = (evaluated_total / total_rules) if total_rules > 0 else 0.0

    violated_rules = [v.rule_id for v in verdicts if v.status == RuleVerdictStatus.VIOLATED]
    passed_rules = [v.rule_id for v in verdicts if v.status == RuleVerdictStatus.PASSED]
    unevaluated_rules = [v.rule_id for v in verdicts if v.status == RuleVerdictStatus.UNEVALUATED]

    explanation: list[str] = [
        f"AML/sanctions/reporting: {aml_assessment.passed} passed, {aml_assessment.violated} violated, "
        f"{aml_assessment.unevaluated} unevaluated",
        f"KYC/CDD: {kyc_assessment.passed} passed, {kyc_assessment.violated} violated, "
        f"{kyc_assessment.unevaluated} unevaluated",
        f"Internal governance/other: {policy_assessment.passed} passed, {policy_assessment.violated} violated, "
        f"{policy_assessment.unevaluated} unevaluated",
        f"{evaluated_total}/{total_rules} registry rules could be automatically evaluated from this transaction's "
        "available data; the remainder require evidence (audit trail, KYC file, screening logs) not yet "
        "integrated into SAQR",
    ]
    for v in verdicts:
        if v.status == RuleVerdictStatus.VIOLATED:
            explanation.append(f"VIOLATED [{v.severity.value}] {v.rule_id}: {v.reason}")

    return ComplianceAssessmentOutput(
        transaction_id=request.transaction_id,
        customer_id=request.customer_id,
        compliance_score=compliance_score,
        compliance_status=compliance_status,
        compliance_confidence=compliance_confidence,
        aml_assessment=aml_assessment,
        kyc_assessment=kyc_assessment,
        policy_assessment=policy_assessment,
        violated_rules=violated_rules,
        passed_rules=passed_rules,
        unevaluated_rules=unevaluated_rules,
        compliance_explanation=explanation,
        generated_at=datetime.now(UTC),
    )
