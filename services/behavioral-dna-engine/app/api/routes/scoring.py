from fastapi import APIRouter, Depends

from app.api.deps import get_service, get_token_service
from app.api.schemas import DnaOutputResponse, TransactionEventRequest
from app.domain.entities import TransactionEvent
from app.profile.service import BehavioralDnaService
from app.token_station.service import TokenStationService

router = APIRouter(tags=["scoring"])


@router.post("/transactions/score", response_model=DnaOutputResponse)
async def score_transaction(
    body: TransactionEventRequest,
    service: BehavioralDnaService = Depends(get_service),
    token_service: TokenStationService = Depends(get_token_service),
) -> DnaOutputResponse:
    """Every request entering Agent 1 registers into the Token Generation Station first
    (get-or-create, idempotent on body.tx_id - never regenerated) before behavioral
    analysis runs. This does not change tx_id/transaction_id semantics for existing
    callers (e.g. the bulk backfill pipeline, which calls BehavioralDnaService directly
    and never touches this route) - it only ever adds tracking for whatever tx_id was
    already supplied.
    """
    token = await token_service.get_or_create_token(
        transaction_id=body.tx_id,
        account_id=body.sender_account_id,
        receiver_account_id=body.receiver_account_id,
        amount=body.amount,
        transaction_type=body.tx_type,
    )

    event = TransactionEvent(**body.model_dump())
    output = await service.score_transaction(event)
    return DnaOutputResponse(**output.model_dump(), saqr_token=token.transaction_id)
