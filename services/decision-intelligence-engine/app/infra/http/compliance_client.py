import logging

import httpx

from app.domain.entities import ComplianceSnapshot, DecisionRequest
from app.domain.ports import ComplianceClient

logger = logging.getLogger(__name__)


class HttpComplianceClient(ComplianceClient):
    """Calls Agent 4's existing POST /compliance/evaluate - no new endpoint,
    no modification to Agent 4."""

    def __init__(self, client: httpx.AsyncClient, base_url: str, timeout_seconds: float) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds

    async def evaluate_compliance(self, request: DecisionRequest) -> ComplianceSnapshot | None:
        try:
            response = await self._client.post(
                f"{self._base_url}/compliance/evaluate",
                json={
                    "transaction_id": request.transaction_id,
                    "customer_id": request.customer_id,
                    "account_id": request.account_id,
                    "receiver_account_id": request.receiver_account_id,
                    "amount": request.amount,
                    "occurred_at": request.occurred_at.isoformat(),
                    "tx_type": request.tx_type,
                },
                timeout=self._timeout,
            )
            response.raise_for_status()
            data = response.json()
            return ComplianceSnapshot(
                compliance_status=data["compliance_status"],
                compliance_score=data["compliance_score"],
                compliance_confidence=data["compliance_confidence"],
                violated_rules=data.get("violated_rules") or [],
                regulatory_findings=data.get("compliance_explanation") or [],
            )
        except (httpx.TimeoutException, httpx.HTTPError, KeyError) as exc:
            logger.warning(
                "Agent 4 compliance evaluation failed for transaction_id=%s: %s", request.transaction_id, exc
            )
            return None
