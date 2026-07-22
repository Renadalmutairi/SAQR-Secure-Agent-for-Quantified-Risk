import asyncio

from app.domain.entities import ComplianceAssessmentOutput, ComplianceEvaluationRequest
from app.domain.ports import (
    BehavioralDnaClient,
    CustomerProfileProvider,
    EvaluationContext,
    GraphIntelligenceClient,
    PolicyProvider,
    TrustIntelligenceClient,
)
from app.policy.engine import RuleEvaluationEngine
from app.policy.explainer import build_compliance_output


class ComplianceEvaluationService:
    """Orchestrates one compliance evaluation: fetch Agent 1, Agent 2, Agent 3,
    and the customer profile concurrently (exactly four HTTP round trips, one
    per upstream source, none of them blocking on the others), then run every
    registry rule as a pure function over that shared context. No DB, no
    Kafka, no cache, no background workers - a single synchronous fan-out per
    request, same shape as Agent 3.
    """

    def __init__(
        self,
        behavioral_client: BehavioralDnaClient,
        graph_client: GraphIntelligenceClient,
        trust_client: TrustIntelligenceClient,
        customer_profile_provider: CustomerProfileProvider,
        policy_provider: PolicyProvider,
        rule_engine: RuleEvaluationEngine,
    ) -> None:
        self._behavioral_client = behavioral_client
        self._graph_client = graph_client
        self._trust_client = trust_client
        self._customer_profile_provider = customer_profile_provider
        self._policy_provider = policy_provider
        self._rule_engine = rule_engine

    async def evaluate(self, request: ComplianceEvaluationRequest) -> ComplianceAssessmentOutput:
        behavioral, structural, trust, customer_profile = await asyncio.gather(
            self._behavioral_client.get_profile(request.customer_id),
            self._graph_client.get_output(request.account_id),
            self._trust_client.evaluate_trust(request.transaction_id, request.customer_id, request.account_id),
            self._customer_profile_provider.get_profile(request.customer_id),
        )
        context = EvaluationContext(
            request=request,
            behavioral=behavioral,
            structural=structural,
            trust=trust,
            customer_profile=customer_profile,
        )

        rules = self._policy_provider.get_rules()
        verdicts = self._rule_engine.evaluate_all(rules, context)
        return build_compliance_output(request, verdicts)
