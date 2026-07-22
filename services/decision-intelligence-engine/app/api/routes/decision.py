from fastapi import APIRouter, Depends

from app.api.deps import get_evaluation_service
from app.domain.entities import DecisionOutput, DecisionRequest
from app.service import DecisionEvaluationService

router = APIRouter(tags=["decision"])


@router.post("/decision/evaluate", response_model=DecisionOutput)
async def evaluate_decision(
    request: DecisionRequest,
    service: DecisionEvaluationService = Depends(get_evaluation_service),
) -> DecisionOutput:
    """Exactly four concurrent HTTP calls (Agent 1, 2, 3, 4), then a pure
    in-memory weighted fusion. Generates no new intelligence - every value in
    the response is derived from the four upstream agents' own outputs.
    Degrades gracefully - any unavailable upstream is excluded from fusion
    entirely (never treated as neutral or zero-risk)."""
    return await service.evaluate(request)
