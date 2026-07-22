import asyncio
from datetime import UTC, datetime

from app.domain.entities import TrustEvaluationRequest, TrustIntelligenceOutput
from app.domain.ports import BehavioralDnaClient, EvidenceContext, EvidenceProvider, GraphIntelligenceClient
from app.fusion.engine import EvidenceFusionEngine
from app.fusion.explainer import build_explanation, dominant_factors


class TrustEvaluationService:
    """Orchestrates one trust evaluation: fetch Agent 1 and Agent 2 evidence
    concurrently (exactly two HTTP round trips, regardless of provider count),
    run every provider as a pure function over that shared context, fuse, explain.
    O(1) per transaction - no historical replay, no recomputation, no DB scans.
    """

    def __init__(
        self,
        behavioral_client: BehavioralDnaClient,
        graph_client: GraphIntelligenceClient,
        providers: list[EvidenceProvider],
        fusion_engine: EvidenceFusionEngine,
    ) -> None:
        self._behavioral_client = behavioral_client
        self._graph_client = graph_client
        self._providers = providers
        self._fusion_engine = fusion_engine

    async def evaluate(self, request: TrustEvaluationRequest) -> TrustIntelligenceOutput:
        profile, graph_output = await asyncio.gather(
            self._behavioral_client.get_profile(request.customer_id),
            self._graph_client.get_output(request.account_id),
        )
        context = EvidenceContext(request=request, profile=profile, graph_output=graph_output)

        evidences = [provider.get_evidence(context) for provider in self._providers]
        result = self._fusion_engine.fuse(evidences)
        positive, negative = dominant_factors(result.contributions)
        missing = [e.source for e in evidences if not e.available]
        explanation = build_explanation(result.trust_score, result.confidence_level, result.contributions, missing)

        return TrustIntelligenceOutput(
            transaction_id=request.transaction_id,
            customer_id=request.customer_id,
            account_id=request.account_id,
            trust_score=result.trust_score,
            confidence_level=result.confidence_level,
            evidence_breakdown=result.contributions,
            dominant_positive_factors=positive,
            dominant_negative_factors=negative,
            missing_evidence=missing,
            explanation=explanation,
            generated_at=datetime.now(UTC),
        )
