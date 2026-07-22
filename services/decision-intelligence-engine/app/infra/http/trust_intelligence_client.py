import logging

import httpx

from app.domain.entities import TrustSnapshot
from app.domain.ports import TrustIntelligenceClient

logger = logging.getLogger(__name__)


class HttpTrustIntelligenceClient(TrustIntelligenceClient):
    """Calls Agent 3's existing POST /trust/evaluate - no new endpoint, no
    modification to Agent 3."""

    def __init__(self, client: httpx.AsyncClient, base_url: str, timeout_seconds: float) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds

    async def evaluate_trust(self, transaction_id: str, customer_id: str, account_id: str) -> TrustSnapshot | None:
        try:
            response = await self._client.post(
                f"{self._base_url}/trust/evaluate",
                json={"transaction_id": transaction_id, "customer_id": customer_id, "account_id": account_id},
                timeout=self._timeout,
            )
            response.raise_for_status()
            data = response.json()
            return TrustSnapshot(
                trust_score=data["trust_score"],
                confidence_level=data["confidence_level"],
                dominant_positive_factors=data.get("dominant_positive_factors") or [],
                dominant_negative_factors=data.get("dominant_negative_factors") or [],
            )
        except (httpx.TimeoutException, httpx.HTTPError, KeyError) as exc:
            logger.warning(
                "Agent 3 trust evaluation failed for transaction_id=%s customer_id=%s: %s",
                transaction_id,
                customer_id,
                exc,
            )
            return None
