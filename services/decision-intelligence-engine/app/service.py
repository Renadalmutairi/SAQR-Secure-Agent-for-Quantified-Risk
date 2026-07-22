import asyncio

from app.domain.entities import DecisionOutput, DecisionRequest
from app.domain.ports import (
    BehavioralDnaClient,
    ComplianceClient,
    EvidenceContext,
    GraphIntelligenceClient,
    TrustIntelligenceClient,
)
from app.fusion.config import RiskThresholds
from app.fusion.decision import resolve_decision
from app.fusion.engine import RiskFusionEngine
from app.fusion.explainer import build_decision_output


class DecisionEvaluationService:
    """Orchestrates one decision: fetch Agent 1, 2, 3, 4 outputs concurrently
    (exactly four HTTP round trips, one per upstream agent), fuse into a
    single risk score, apply the compliance override, explain. Generates no
    intelligence of its own - every number here is derived from the four
    upstream agents. No DB, no Kafka, no cache - a single synchronous fan-out
    per request, same shape as Agent 3 and Agent 4.
    """

    def __init__(
        self,
        behavioral_client: BehavioralDnaClient,
        graph_client: GraphIntelligenceClient,
        trust_client: TrustIntelligenceClient,
        compliance_client: ComplianceClient,
        fusion_engine: RiskFusionEngine,
        risk_thresholds: RiskThresholds,
    ) -> None:
        self._behavioral_client = behavioral_client
        self._graph_client = graph_client
        self._trust_client = trust_client
        self._compliance_client = compliance_client
        self._fusion_engine = fusion_engine
        self._risk_thresholds = risk_thresholds

    async def evaluate(self, request: DecisionRequest) -> DecisionOutput:
        behavioral, graph, trust, compliance = await asyncio.gather(
            self._behavioral_client.get_profile(request.customer_id),
            self._graph_client.get_output(request.account_id),
            self._trust_client.evaluate_trust(request.transaction_id, request.customer_id, request.account_id),
            self._compliance_client.evaluate_compliance(request),
        )
        context = EvidenceContext(request=request, behavioral=behavioral, graph=graph, trust=trust, compliance=compliance)

        fusion_result = self._fusion_engine.fuse(context)
        decision, risk_level, override_reason = resolve_decision(
            fusion_result.overall_risk_score, compliance, self._risk_thresholds
        )

        return build_decision_output(request, context, fusion_result, decision, risk_level, override_reason)
