from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_token_service
from app.api.schemas import (
    DatabaseMetricsResponse,
    DatabaseStatusResponse,
    TokenAuditEventResponse,
    TokenDetailResponse,
    TokenGenerateRequest,
    TokenRegistryResponse,
    TokenStageResultResponse,
    TokenStatusUpdateRequest,
)
from app.token_station.service import TokenStationService

router = APIRouter(tags=["tokens"])


@router.get("/tokens/db-status", response_model=DatabaseStatusResponse)
async def get_db_status(service: TokenStationService = Depends(get_token_service)) -> DatabaseStatusResponse:
    """A real SELECT 1, not a cached value - this is what the dashboard's Generate-button
    gating and automatic re-enable are built on. Never faked."""
    online = await service.is_database_online()
    return DatabaseStatusResponse(database="online" if online else "offline")


@router.get("/tokens/db-metrics", response_model=DatabaseMetricsResponse)
async def get_db_metrics(service: TokenStationService = Depends(get_token_service)) -> DatabaseMetricsResponse:
    """Real pg_database_size/pg_total_relation_size readings - what the benchmark
    suite's Database Performance and Infrastructure Cost sections read directly."""
    metrics = await service.get_database_metrics()
    return DatabaseMetricsResponse(**metrics.model_dump())


@router.post("/tokens/generate", response_model=TokenRegistryResponse)
async def generate_token(
    body: TokenGenerateRequest, service: TokenStationService = Depends(get_token_service)
) -> TokenRegistryResponse:
    """The Token Generation Station's entry point. Mints a new SAQR-TX-XXXXXXXX and
    persists it - or, if called again for the same transaction, returns the existing
    token unchanged. Never regenerates."""
    entry = await service.get_or_create_token(
        transaction_id=None,
        account_id=body.account_id,
        receiver_account_id=body.receiver_account_id,
        amount=body.amount,
        transaction_type=body.transaction_type,
        customer_id=body.customer_id,
    )
    return TokenRegistryResponse(**entry.model_dump())


@router.get("/tokens/{token}", response_model=TokenDetailResponse)
async def get_token(token: str, service: TokenStationService = Depends(get_token_service)) -> TokenDetailResponse:
    entry = await service.get_token(token)
    if entry is None:
        raise HTTPException(status_code=404, detail="Unknown SAQR token")
    stage_results = await service.get_stage_results(token)
    return TokenDetailResponse(
        registry=TokenRegistryResponse(**entry.model_dump()),
        stage_results=[TokenStageResultResponse(**r.model_dump(exclude={"transaction_id"})) for r in stage_results],
    )


@router.get("/tokens/{token}/timeline", response_model=list[TokenAuditEventResponse])
async def get_token_timeline(
    token: str, service: TokenStationService = Depends(get_token_service)
) -> list[TokenAuditEventResponse]:
    entry = await service.get_token(token)
    if entry is None:
        raise HTTPException(status_code=404, detail="Unknown SAQR token")
    events = await service.get_timeline(token)
    return [TokenAuditEventResponse(**e.model_dump(exclude={"transaction_id"})) for e in events]


@router.patch("/tokens/{token}/status", response_model=TokenRegistryResponse)
async def update_token_status(
    token: str, body: TokenStatusUpdateRequest, service: TokenStationService = Depends(get_token_service)
) -> TokenRegistryResponse:
    """The only way any status column or timeline entry is ever written after creation.
    Called by the dashboard orchestrator between each of its 5 pipeline stages - never by
    the frontend directly."""
    entry = await service.get_token(token)
    if entry is None:
        raise HTTPException(status_code=404, detail="Unknown SAQR token")
    updated = await service.update_stage_status(
        transaction_id=token, stage=body.stage, status=body.status, detail=body.detail, result=body.result
    )
    return TokenRegistryResponse(**updated.model_dump())
