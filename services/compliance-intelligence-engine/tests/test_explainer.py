from app.domain.entities import RuleCategory, RuleSeverity, RuleVerdict, RuleVerdictStatus
from app.policy.explainer import build_compliance_output


def _verdict(rule_id, category, status, severity=RuleSeverity.VIOLATION_IF_MISSING, reason="r"):
    return RuleVerdict(rule_id=rule_id, category=category, severity=severity, status=status, reason=reason)


def test_all_passed_yields_compliant_status_and_score_one(request_):
    verdicts = [
        _verdict("A1", RuleCategory.AML, RuleVerdictStatus.PASSED),
        _verdict("K1", RuleCategory.KYC_CDD, RuleVerdictStatus.PASSED),
    ]
    output = build_compliance_output(request_, verdicts)
    assert output.compliance_status == "compliant"
    assert output.compliance_score == 1.0
    assert output.violated_rules == []
    assert output.passed_rules == ["A1", "K1"]


def test_blocking_violation_forces_non_compliant_and_zero_score(request_):
    verdicts = [
        _verdict("A1", RuleCategory.AML, RuleVerdictStatus.VIOLATED, severity=RuleSeverity.BLOCKING),
        _verdict("K1", RuleCategory.KYC_CDD, RuleVerdictStatus.PASSED),
    ]
    output = build_compliance_output(request_, verdicts)
    assert output.compliance_status == "non_compliant"
    assert output.compliance_score == 0.0
    assert "A1" in output.violated_rules
    assert any("VIOLATED" in line and "A1" in line for line in output.compliance_explanation)


def test_non_blocking_violation_yields_requires_review(request_):
    verdicts = [
        _verdict("A1", RuleCategory.AML, RuleVerdictStatus.VIOLATED, severity=RuleSeverity.VIOLATION_IF_MISSING),
    ]
    output = build_compliance_output(request_, verdicts)
    assert output.compliance_status == "requires_review"
    assert output.compliance_score == 0.0  # 0 passed / 1 evaluated in that category


def test_all_unevaluated_yields_zero_confidence(request_):
    verdicts = [
        _verdict("A1", RuleCategory.AML, RuleVerdictStatus.UNEVALUATED),
        _verdict("K1", RuleCategory.KYC_CDD, RuleVerdictStatus.UNEVALUATED),
    ]
    output = build_compliance_output(request_, verdicts)
    assert output.compliance_confidence == 0.0
    assert output.compliance_status == "compliant"  # no violations observed, but confidence flags it as unverified
    assert output.unevaluated_rules == ["A1", "K1"]


def test_category_bucket_mapping(request_):
    verdicts = [
        _verdict("A1", RuleCategory.AML, RuleVerdictStatus.PASSED),
        _verdict("A2", RuleCategory.SANCTIONS_SCREENING, RuleVerdictStatus.PASSED),
        _verdict("A3", RuleCategory.TRANSACTION_MONITORING, RuleVerdictStatus.PASSED),
        _verdict("A4", RuleCategory.REPORTING_OBLIGATIONS, RuleVerdictStatus.PASSED),
        _verdict("A5", RuleCategory.REGULATORY_THRESHOLDS, RuleVerdictStatus.PASSED),
        _verdict("K1", RuleCategory.KYC_CDD, RuleVerdictStatus.PASSED),
        _verdict("P1", RuleCategory.INTERNAL_GOVERNANCE, RuleVerdictStatus.PASSED),
        _verdict("P2", RuleCategory.OTHER, RuleVerdictStatus.PASSED),
    ]
    output = build_compliance_output(request_, verdicts)
    assert output.aml_assessment.passed == 5
    assert output.kyc_assessment.passed == 1
    assert output.policy_assessment.passed == 2


def test_empty_verdict_list_does_not_crash(request_):
    output = build_compliance_output(request_, [])
    assert output.compliance_confidence == 0.0
    assert output.compliance_score == 1.0
    assert output.compliance_status == "compliant"
