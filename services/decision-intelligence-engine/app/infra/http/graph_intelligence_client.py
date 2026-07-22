import logging

import httpx

from app.domain.entities import GraphSnapshot
from app.domain.ports import GraphIntelligenceClient

logger = logging.getLogger(__name__)


class HttpGraphIntelligenceClient(GraphIntelligenceClient):
    """Calls Agent 2's existing GET /accounts/{account_id}/output - no new
    endpoint, no modification to Agent 2."""

    def __init__(self, client: httpx.AsyncClient, base_url: str, timeout_seconds: float) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds

    async def get_output(self, account_id: str) -> GraphSnapshot | None:
        try:
            response = await self._client.get(f"{self._base_url}/accounts/{account_id}/output", timeout=self._timeout)
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()
            structural_features = data.get("structural_features") or {}
            anomalies = data.get("structural_anomalies") or []
            return GraphSnapshot(
                entity_id=data["entity_id"],
                structural_complexity_score=structural_features.get("structural_complexity_score", 0.0),
                graph_confidence_score=data["graph_confidence_score"],
                community_id=data.get("community_id"),
                community_size=data.get("community_size"),
                anomaly_descriptions=[a["description"] for a in anomalies if "description" in a],
            )
        except (httpx.TimeoutException, httpx.HTTPError, KeyError) as exc:
            logger.warning("Agent 2 graph output lookup failed for account_id=%s: %s", account_id, exc)
            return None
