from app.domain.entities import PolicyRule, RuleVerdict, RuleVerdictStatus
from app.domain.ports import EvaluationContext, TriggerEvaluator


class RuleEvaluationEngine:
    """Iterates every rule in the registry and produces exactly one
    RuleVerdict per rule. Any trigger with no registered evaluator - the
    majority of the registry - resolves to UNEVALUATED. This default must
    never silently become PASSED: an unevaluated rule is not a satisfied
    rule, and pretending otherwise would make the compliance_score
    meaningless."""

    def __init__(self, evaluators: list[TriggerEvaluator]) -> None:
        self._by_trigger: dict[str, TriggerEvaluator] = {e.trigger_name: e for e in evaluators}

    def evaluate_all(self, rules: list[PolicyRule], context: EvaluationContext) -> list[RuleVerdict]:
        verdicts: list[RuleVerdict] = []
        for rule in rules:
            evaluator = self._by_trigger.get(rule.trigger)
            if evaluator is None:
                status, reason = (
                    RuleVerdictStatus.UNEVALUATED,
                    f"no automated evaluator registered for trigger '{rule.trigger}' in v1",
                )
            else:
                status, reason = evaluator.evaluate(rule, context)

            verdicts.append(
                RuleVerdict(
                    rule_id=rule.rule_id,
                    category=rule.category,
                    severity=rule.severity,
                    status=status,
                    reason=reason,
                )
            )
        return verdicts
