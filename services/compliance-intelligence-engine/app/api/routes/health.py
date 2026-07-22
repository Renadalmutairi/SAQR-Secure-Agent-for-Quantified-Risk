from fastapi import APIRouter, Depends

from app.api.deps import get_container
from app.wiring import Container

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "agent": "compliance-intelligence-engine"}


@router.get("/policy/registry-status")
async def registry_status(container: Container = Depends(get_container)) -> dict:
    rules = container.policy_provider.get_rules()
    return {"rules_loaded": len(rules), "registry_dir": container.settings.policy_registry_dir}
