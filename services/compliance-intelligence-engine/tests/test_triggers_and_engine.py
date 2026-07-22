from app.domain.entities import RuleVerdictStatus
from app.domain.ports import EvaluationContext
from app.policy.engine import RuleEvaluationEngine
from app.policy.triggers import (
    AmountAgnosticEvaluationEvaluator,
    CddIncompleteEvaluator,
    CustomerProfileDependentEvaluator,
    TransactionScreeningEvaluator,
    WireTransferInfoEvaluator,
    build_default_evaluators,
)
from tests.conftest import make_rule


def _context(request_, behavioral=None, structural=None, trust=None, customer_profile=None):
    return EvaluationContext(
        request=request_, behavioral=behavioral, structural=structural, trust=trust, customer_profile=customer_profile
    )


def test_cdd_incomplete_violated_when_both_agent1_and_agent2_unavailable(request_):
    ctx = _context(request_)
    status, _ = CddIncompleteEvaluator().evaluate(make_rule("R1", "cdd_incomplete"), ctx)
    assert status == RuleVerdictStatus.VIOLATED


def test_cdd_incomplete_passed_when_behavioral_available(request_, behavioral):
    ctx = _context(request_, behavioral=behavioral)
    status, _ = CddIncompleteEvaluator().evaluate(make_rule("R1", "cdd_incomplete"), ctx)
    assert status == RuleVerdictStatus.PASSED


def test_cdd_incomplete_violated_when_structural_is_zero_confidence_not_none(request_, zero_confidence_structural):
    """Regression: Agent 2 returns HTTP 200 with zero values (not a 404/None)
    for an account it has never seen - graph_confidence_score=0.0 signals
    that, and CddIncompleteEvaluator must still call this a violation."""
    ctx = _context(request_, structural=zero_confidence_structural)
    status, _ = CddIncompleteEvaluator().evaluate(make_rule("R1", "cdd_incomplete"), ctx)
    assert status == RuleVerdictStatus.VIOLATED


def test_cdd_incomplete_passed_when_structural_has_real_confidence(request_, structural):
    ctx = _context(request_, structural=structural)
    status, _ = CddIncompleteEvaluator().evaluate(make_rule("R1", "cdd_incomplete"), ctx)
    assert status == RuleVerdictStatus.PASSED


def test_wire_transfer_passed_when_accounts_present(request_):
    ctx = _context(request_)
    status, _ = WireTransferInfoEvaluator().evaluate(make_rule("R2", "wire_transfer"), ctx)
    assert status == RuleVerdictStatus.PASSED


def test_transaction_screening_unevaluated_when_no_data(request_):
    ctx = _context(request_)
    status, _ = TransactionScreeningEvaluator().evaluate(make_rule("R3", "transaction_screening"), ctx)
    assert status == RuleVerdictStatus.UNEVALUATED


def test_transaction_screening_passed_when_structural_available(request_, structural):
    ctx = _context(request_, structural=structural)
    status, _ = TransactionScreeningEvaluator().evaluate(make_rule("R3", "transaction_screening"), ctx)
    assert status == RuleVerdictStatus.PASSED


def test_transaction_screening_unevaluated_when_trust_is_fully_degraded(request_, zero_confidence_trust):
    """Regression: Agent 3 always returns a non-null TrustSnapshot even when
    every evidence source was unavailable (confidence_level=0.0) - that must
    not be mistaken for 'screening occurred'."""
    ctx = _context(request_, trust=zero_confidence_trust)
    status, _ = TransactionScreeningEvaluator().evaluate(make_rule("R3", "transaction_screening"), ctx)
    assert status == RuleVerdictStatus.UNEVALUATED


def test_transaction_screening_unevaluated_when_structural_is_zero_confidence_not_none(
    request_, zero_confidence_structural
):
    """Regression: Agent 2 returns HTTP 200 with zero values (not None) for an
    unknown account - graph_confidence_score=0.0 must not be mistaken for
    'this transaction was screened'."""
    ctx = _context(request_, structural=zero_confidence_structural)
    status, _ = TransactionScreeningEvaluator().evaluate(make_rule("R3", "transaction_screening"), ctx)
    assert status == RuleVerdictStatus.UNEVALUATED


def test_transaction_screening_unevaluated_when_both_sources_zero_confidence(
    request_, zero_confidence_structural, zero_confidence_trust
):
    ctx = _context(request_, structural=zero_confidence_structural, trust=zero_confidence_trust)
    status, _ = TransactionScreeningEvaluator().evaluate(make_rule("R3", "transaction_screening"), ctx)
    assert status == RuleVerdictStatus.UNEVALUATED


def test_transaction_screening_passed_when_trust_has_real_confidence(request_, trust):
    ctx = _context(request_, trust=trust)
    status, _ = TransactionScreeningEvaluator().evaluate(make_rule("R3", "transaction_screening"), ctx)
    assert status == RuleVerdictStatus.PASSED


def test_amount_agnostic_always_passed(request_):
    ctx = _context(request_)
    status, reason = AmountAgnosticEvaluationEvaluator().evaluate(
        make_rule("R4", "suspicion_of_money_laundering"), ctx
    )
    assert status == RuleVerdictStatus.PASSED
    assert "15000" in reason


def test_customer_profile_dependent_always_unevaluated_in_v1(request_):
    ctx = _context(request_)
    status, _ = CustomerProfileDependentEvaluator("customer_is_pep").evaluate(
        make_rule("R5", "customer_is_pep"), ctx
    )
    assert status == RuleVerdictStatus.UNEVALUATED


def test_engine_defaults_unregistered_trigger_to_unevaluated(request_):
    engine = RuleEvaluationEngine(build_default_evaluators())
    rule = make_rule("R6", "screening_cadence_review")  # no evaluator registered for this trigger
    verdicts = engine.evaluate_all([rule], _context(request_))
    assert verdicts[0].status == RuleVerdictStatus.UNEVALUATED
    assert "no automated evaluator" in verdicts[0].reason


def test_engine_never_silently_passes_unregistered_rules(request_):
    """Regression guard: the whole point of the unevaluated-by-default design
    is that an unknown trigger must never resolve to PASSED."""
    engine = RuleEvaluationEngine(build_default_evaluators())
    rules = [make_rule(f"R{i}", f"unknown_trigger_{i}") for i in range(5)]
    verdicts = engine.evaluate_all(rules, _context(request_))
    assert all(v.status == RuleVerdictStatus.UNEVALUATED for v in verdicts)


def test_engine_evaluates_one_verdict_per_rule(request_, behavioral, structural):
    engine = RuleEvaluationEngine(build_default_evaluators())
    rules = [
        make_rule("R1", "cdd_incomplete"),
        make_rule("R2", "wire_transfer"),
        make_rule("R3", "transaction_screening"),
        make_rule("R4", "unregistered_trigger"),
    ]
    verdicts = engine.evaluate_all(rules, _context(request_, behavioral=behavioral, structural=structural))
    assert len(verdicts) == 4
    assert [v.rule_id for v in verdicts] == ["R1", "R2", "R3", "R4"]
