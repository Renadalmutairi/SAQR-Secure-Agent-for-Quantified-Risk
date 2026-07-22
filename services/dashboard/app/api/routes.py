import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import Settings
from app.orchestrator import DemoRunRequest, DemoRunResult, PipelineOrchestrator
from app.wiring import Container

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["dashboard"])


def get_container(request: Request) -> Container:
    return request.app.state.container


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "agent": "dashboard"}


@router.get("/db-status")
async def db_status(container: Container = Depends(get_container)) -> dict:
    """Proxies Agent 1's real SELECT 1 check - never cached or assumed here."""
    try:
        response = await container.http_client.get(
            f"{container.settings.behavioral_dna_base_url}/tokens/db-status",
            timeout=container.settings.upstream_timeout_seconds,
        )
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("db-status check failed: %s", exc)
        return {"database": "offline"}


@router.post("/demo/run", response_model=DemoRunResult)
async def run_demo(
    body: DemoRunRequest, container: Container = Depends(get_container)
) -> DemoRunResult:
    return await container.orchestrator.run(body)


@router.get("/tokens/{token}")
async def get_token(token: str, container: Container = Depends(get_container)) -> dict:
    response = await container.http_client.get(
        f"{container.settings.behavioral_dna_base_url}/tokens/{token}",
        timeout=container.settings.upstream_timeout_seconds,
    )
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Unknown SAQR token")
    response.raise_for_status()
    return response.json()


@router.get("/tokens/{token}/timeline")
async def get_token_timeline(token: str, container: Container = Depends(get_container)) -> list:
    response = await container.http_client.get(
        f"{container.settings.behavioral_dna_base_url}/tokens/{token}/timeline",
        timeout=container.settings.upstream_timeout_seconds,
    )
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Unknown SAQR token")
    response.raise_for_status()
    return response.json()


@router.get("/graph/{token}")
async def get_relationship_graph(token: str, container: Container = Depends(get_container)) -> dict:
    """Real Agent 2 data only - two nodes (sender/receiver) and, if one already exists,
    the edge between them. Never fabricates a wider neighborhood: Agent 2 doesn't expose
    one, and this endpoint doesn't pretend otherwise."""
    settings: Settings = container.settings
    client = container.http_client
    timeout = settings.upstream_timeout_seconds

    token_response = await client.get(f"{settings.behavioral_dna_base_url}/tokens/{token}", timeout=timeout)
    if token_response.status_code == 404:
        raise HTTPException(status_code=404, detail="Unknown SAQR token")
    token_response.raise_for_status()
    registry = token_response.json()["registry"]
    sender_id = registry["account_id"]
    receiver_id = registry["receiver_account_id"]

    async def _node(account_id: str, role: str) -> dict:
        resp = await client.get(f"{settings.graph_intelligence_base_url}/accounts/{account_id}/output", timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("structural_features") or {}
        return {
            "id": account_id,
            "role": role,
            "degree": features.get("degree", 0),
            "fan_in": features.get("fan_in", 0),
            "fan_out": features.get("fan_out", 0),
            "community_id": data.get("community_id"),
            "structural_complexity_score": features.get("structural_complexity_score", 0.0),
            "graph_confidence_score": data.get("graph_confidence_score", 0.0),
        }

    sender_node = await _node(sender_id, "sender")
    receiver_node = await _node(receiver_id, "receiver")

    edges = []
    metrics_resp = await client.get(
        f"{settings.graph_intelligence_base_url}/accounts/{sender_id}/relationships/{receiver_id}/metrics",
        timeout=timeout,
    )
    if metrics_resp.status_code == 200:
        m = metrics_resp.json()
        edges.append(
            {
                "source": sender_id,
                "target": receiver_id,
                "average_amount": m["average_amount"],
                "relationship_age_seconds": m["relationship_age_seconds"],
                "structural_trust_score": m["structural_trust_score"],
                "temporal_consistency": m["temporal_consistency"],
            }
        )

    return {"nodes": [sender_node, receiver_node], "edges": edges}
