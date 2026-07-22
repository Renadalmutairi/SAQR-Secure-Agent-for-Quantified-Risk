from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_service
from app.api.schemas import AccountContextResponse, AuditVerificationResponse, ProfileResponse
from app.profile.service import BehavioralDnaService

router = APIRouter(tags=["profiles"])


@router.get("/customers/{customer_id}/profile", response_model=ProfileResponse)
async def get_current_profile(
    customer_id: str, service: BehavioralDnaService = Depends(get_service)
) -> ProfileResponse:
    profile = await service.get_profile(customer_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="No Behavioral DNA profile for this customer yet")
    return ProfileResponse(**profile.model_dump())


@router.get("/customers/{customer_id}/profile/history", response_model=list[ProfileResponse])
async def get_profile_history(
    customer_id: str, limit: int = 100, service: BehavioralDnaService = Depends(get_service)
) -> list[ProfileResponse]:
    history = await service.get_profile_history(customer_id, limit=limit)
    return [ProfileResponse(**p.model_dump()) for p in history]


@router.get("/customers/{customer_id}/profile/audit", response_model=AuditVerificationResponse)
async def verify_audit_trail(
    customer_id: str, service: BehavioralDnaService = Depends(get_service)
) -> AuditVerificationResponse:
    intact = await service.verify_audit_trail(customer_id)
    return AuditVerificationResponse(customer_id=customer_id, chain_intact=intact)


@router.get("/accounts/{account_id}/context", response_model=AccountContextResponse)
async def get_account_context(
    account_id: str, service: BehavioralDnaService = Depends(get_service)
) -> AccountContextResponse:
    context = await service.get_account_context(account_id)
    if context is None:
        raise HTTPException(status_code=404, detail="No behavioral context for this account yet")
    return AccountContextResponse(**context.model_dump())
