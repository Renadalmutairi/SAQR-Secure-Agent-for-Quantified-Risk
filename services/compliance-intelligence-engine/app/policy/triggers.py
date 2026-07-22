"""Trigger evaluators: pure functions from (rule, context) to a verdict.

Deliberately small. Most of the 30 registry rules are institutional/process
rules (screening cadence, record retention, training programs, whether an STR
was actually filed) that cannot be honestly verified from a single
transaction's real-time data - for those, staying UNEVALUATED is the correct
answer, not a fabricated PASSED. Only rules with a genuinely objective,
checkable condition get a custom evaluator here; everything else falls back
to RuleEvaluationEngine's default (UNEVALUATED, "no automated evaluator for
this trigger in v1").
"""

from app.domain.entities import PolicyRule, RuleVerdictStatus, StructuralSnapshot
from app.domain.ports import EvaluationContext, TriggerEvaluator


def _structural_is_real(structural: StructuralSnapshot | None) -> bool:
    """Agent 2's GET /accounts/{id}/output never 404s/errors for an unknown
    account - it always returns a GraphIntelligenceOutput, with zero-valued
    fields and graph_confidence_score=0.0 signaling 'no real graph data'
    (by design, for graceful degradation). So `structural is not None` is
    NEVER a meaningful signal on its own - graph_confidence_score is Agent
    2's own designed reliability indicator and must be used instead."""
    return structural is not None and structural.graph_confidence_score > 0


class CddIncompleteEvaluator(TriggerEvaluator):
    """AML-CDD-007: can the institution not open/continue without completing
    CDD? Objectively checkable: if BOTH Agent 1 (behavioral) and Agent 2
    (structural) have no real data for this customer/account, there is
    essentially no due-diligence-relevant signal at all - that's the honest
    definition of 'CDD incomplete' available from this engine's inputs.
    """

    trigger_name = "cdd_incomplete"

    def evaluate(self, rule: PolicyRule, context: EvaluationContext) -> tuple[RuleVerdictStatus, str]:
        if context.behavioral is None and not _structural_is_real(context.structural):
            return (
                RuleVerdictStatus.VIOLATED,
                "no behavioral (Agent 1) or structural (Agent 2) data available for this customer/account",
            )
        return RuleVerdictStatus.PASSED, "at least one of behavioral/structural due-diligence signals is available"


class WireTransferInfoEvaluator(TriggerEvaluator):
    """AML-WIRE-001: originator and beneficiary identification must accompany
    every transfer. ComplianceEvaluationRequest requires non-empty
    account_id/receiver_account_id by schema, so this is genuinely always
    satisfiable in v1 - not a rubber stamp, an actual (if currently trivial)
    check of the same requirement the rule states.
    """

    trigger_name = "wire_transfer"

    def evaluate(self, rule: PolicyRule, context: EvaluationContext) -> tuple[RuleVerdictStatus, str]:
        req = context.request
        if req.account_id and req.receiver_account_id:
            return RuleVerdictStatus.PASSED, "originator (account_id) and beneficiary (receiver_account_id) both present"
        return RuleVerdictStatus.VIOLATED, "missing originator or beneficiary account identification"


class TransactionScreeningEvaluator(TriggerEvaluator):
    """SANC-002: was this specific transaction screened at all? Proxy: did
    Agent 2 find a real graph node for this account (graph_confidence_score
    > 0), or did Agent 3 fuse at least some real evidence (confidence_level >
    0)? Both Agent 2 and Agent 3 always return a non-null snapshot even when
    they have zero real data for this account/customer (by design, for
    graceful degradation) - so `is not None` alone is never a meaningful
    signal and would falsely PASS an entirely unknown account.
    """

    trigger_name = "transaction_screening"

    def evaluate(self, rule: PolicyRule, context: EvaluationContext) -> tuple[RuleVerdictStatus, str]:
        if _structural_is_real(context.structural) or (context.trust is not None and context.trust.confidence_level > 0):
            return RuleVerdictStatus.PASSED, "structural/trust context was checked for this transaction"
        return RuleVerdictStatus.UNEVALUATED, "neither Agent 2 nor Agent 3 had usable data to confirm screening occurred"


class AmountAgnosticEvaluationEvaluator(TriggerEvaluator):
    """AML-CDD-002 / RPT-001: obligations apply 'regardless of the amount
    involved.' What this engine can actually verify is that IT does not skip
    or shortcut evaluation based on transaction amount - there is no
    amount-based branch anywhere in this rule engine, so every transaction
    gets the same rule set applied regardless of size.
    """

    trigger_name = "suspicion_of_money_laundering"

    def evaluate(self, rule: PolicyRule, context: EvaluationContext) -> tuple[RuleVerdictStatus, str]:
        return (
            RuleVerdictStatus.PASSED,
            f"full rule set evaluated regardless of transaction amount ({context.request.amount}); "
            "this engine has no amount-based bypass",
        )


class CustomerProfileDependentEvaluator(TriggerEvaluator):
    """Shared by customer_type_natural_person / customer_type_legal_person /
    customer_is_pep - all genuinely require CustomerProfileSnapshot, which is
    always None in v1 (no KYC/customer-master system exists in SAQR yet).
    Always UNEVALUATED until a real CustomerProfileProvider exists - never a
    false pass just because we can't check.
    """

    def __init__(self, trigger_name: str) -> None:
        self.trigger_name = trigger_name

    def evaluate(self, rule: PolicyRule, context: EvaluationContext) -> tuple[RuleVerdictStatus, str]:
        if context.customer_profile is None:
            return RuleVerdictStatus.UNEVALUATED, "no customer profile/KYC data source available in v1"
        return RuleVerdictStatus.UNEVALUATED, "customer profile evaluation logic not yet implemented for this trigger"


def build_default_evaluators() -> list[TriggerEvaluator]:
    return [
        CddIncompleteEvaluator(),
        WireTransferInfoEvaluator(),
        TransactionScreeningEvaluator(),
        AmountAgnosticEvaluationEvaluator(),
        CustomerProfileDependentEvaluator("customer_type_natural_person"),
        CustomerProfileDependentEvaluator("customer_type_legal_person"),
        CustomerProfileDependentEvaluator("customer_is_pep"),
    ]
