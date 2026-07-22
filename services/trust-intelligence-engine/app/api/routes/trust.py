from fastapi import APIRouter, Depends

from app.api.deps import get_evaluation_service
from app.domain.entities import TrustEvaluationRequest, TrustIntelligenceOutput
from app.fusion.service import TrustEvaluationService

router = APIRouter(tags=["trust"])


@router.post("/trust/evaluate", response_model=TrustIntelligenceOutput)
async def evaluate_trust(
    request: TrustEvaluationRequest, service: TrustEvaluationService = Depends(get_evaluation_service)
) -> TrustIntelligenceOutput:
    """O(1): exactly two concurrent HTTP calls (Agent 1, Agent 2), no historical
    replay, no recomputation. Degrades gracefully - if either or both upstream
    agents are unavailable, evaluation still returns a result with reduced
    confidence_level and the missing sources listed in missing_evidence."""
    return await service.evaluate(request)
