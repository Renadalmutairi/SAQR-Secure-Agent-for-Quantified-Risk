from fastapi import APIRouter, Depends

from app.api.deps import get_evaluation_service
from app.domain.entities import ComplianceAssessmentOutput, ComplianceEvaluationRequest
from app.service import ComplianceEvaluationService

router = APIRouter(tags=["compliance"])


@router.post("/compliance/evaluate", response_model=ComplianceAssessmentOutput)
async def evaluate_compliance(
    request: ComplianceEvaluationRequest,
    service: ComplianceEvaluationService = Depends(get_evaluation_service),
) -> ComplianceAssessmentOutput:
    """Exactly four concurrent HTTP calls (Agent 1, Agent 2, Agent 3, customer
    profile), then a pure in-memory rule pass over the Policy Registry.
    Degrades gracefully - any unavailable upstream source causes the rules
    that depend on it to resolve UNEVALUATED, never a false PASSED."""
    return await service.evaluate(request)
