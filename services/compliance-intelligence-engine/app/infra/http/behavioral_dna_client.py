import logging

import httpx

from app.domain.entities import BehavioralSnapshot
from app.domain.ports import BehavioralDnaClient

logger = logging.getLogger(__name__)


class HttpBehavioralDnaClient(BehavioralDnaClient):
    """Calls Agent 1's existing GET /customers/{customer_id}/profile - no new
    endpoint, no modification to Agent 1."""

    def __init__(self, client: httpx.AsyncClient, base_url: str, timeout_seconds: float) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds

    async def get_profile(self, customer_id: str) -> BehavioralSnapshot | None:
        try:
            response = await self._client.get(
                f"{self._base_url}/customers/{customer_id}/profile", timeout=self._timeout
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()
            return BehavioralSnapshot(
                customer_id=data["customer_id"],
                behavioral_risk_score=data.get("behavioral_risk_score"),
                confidence_score=data["confidence_score"],
                history_depth=data["history_depth"],
            )
        except (httpx.TimeoutException, httpx.HTTPError, KeyError) as exc:
            logger.warning("Agent 1 profile lookup failed for customer_id=%s: %s", customer_id, exc)
            return None
