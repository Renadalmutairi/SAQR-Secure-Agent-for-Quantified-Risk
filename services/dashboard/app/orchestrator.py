import logging
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import httpx
from pydantic import BaseModel

from app.config import Settings

logger = logging.getLogger(__name__)


class DemoRunRequest(BaseModel):
    account_id: str
    receiver_account_id: str
    amount: float
    tx_type: str
    customer_id: str | None = None
    occurred_at: datetime | None = None


class StageOutcome(BaseModel):
    stage: str
    status: str  # "completed" | "failed"
    result: dict | None = None
    error: str | None = None
    duration_ms: float = 0.0


class DemoRunResult(BaseModel):
    token: str
    customer_id: str
    stages: list[StageOutcome]
    failed: bool


class PipelineOrchestrator:
    """Drives the demo sequence: mint a token via Agent 1's Token Generation Station,
    then call Agents 1-5 in order, PATCHing Agent 1's token registry after each stage so
    the frontend's polling reflects real, persisted state - never a client-side timer.
    Pure coordination: no scoring, no risk logic, nothing that belongs inside an
    intelligent agent. On any stage failure, the remaining stages are never called and
    never marked complete.
    """

    def __init__(self, client: httpx.AsyncClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings
        self._timeout = settings.upstream_timeout_seconds

    async def run(self, request: DemoRunRequest) -> DemoRunResult:
        occurred_at = request.occurred_at or datetime.now(UTC)
        occurred_at_iso = occurred_at.isoformat()

        gen_response = await self._client.post(
            f"{self._settings.behavioral_dna_base_url}/tokens/generate",
            json={
                "account_id": request.account_id,
                "receiver_account_id": request.receiver_account_id,
                "amount": request.amount,
                "transaction_type": request.tx_type,
                "customer_id": request.customer_id,
            },
            timeout=self._timeout,
        )
        gen_response.raise_for_status()
        registry = gen_response.json()
        token = registry["transaction_id"]
        customer_id = registry["customer_id"]

        common = {
            "transaction_id": token,
            "customer_id": customer_id,
            "account_id": request.account_id,
            "receiver_account_id": request.receiver_account_id,
            "amount": request.amount,
            "occurred_at": occurred_at_iso,
            "tx_type": request.tx_type,
        }

        stage_calls: list[tuple[str, Callable[[], Awaitable[httpx.Response]]]] = [
            (
                "behavioral",
                lambda: self._client.post(
                    f"{self._settings.behavioral_dna_base_url}/transactions/score",
                    json={
                        "tx_id": token,
                        "sender_account_id": request.account_id,
                        "receiver_account_id": request.receiver_account_id,
                        "tx_type": request.tx_type,
                        "amount": request.amount,
                        "occurred_at": occurred_at_iso,
                    },
                    timeout=self._timeout,
                ),
            ),
            (
                "graph",
                lambda: self._client.get(
                    f"{self._settings.graph_intelligence_base_url}/accounts/{request.account_id}/output",
                    timeout=self._timeout,
                ),
            ),
            (
                "trust",
                lambda: self._client.post(
                    f"{self._settings.trust_intelligence_base_url}/trust/evaluate",
                    json={"transaction_id": token, "customer_id": customer_id, "account_id": request.account_id},
                    timeout=self._timeout,
                ),
            ),
            (
                "compliance",
                lambda: self._client.post(
                    f"{self._settings.compliance_base_url}/compliance/evaluate", json=common, timeout=self._timeout
                ),
            ),
            (
                "decision",
                lambda: self._client.post(
                    f"{self._settings.decision_base_url}/decision/evaluate", json=common, timeout=self._timeout
                ),
            ),
        ]

        stages: list[StageOutcome] = []
        for stage_name, call in stage_calls:
            outcome = await self._run_stage(token, stage_name, call)
            stages.append(outcome)
            if outcome.status == "failed":
                return DemoRunResult(token=token, customer_id=customer_id, stages=stages, failed=True)

        return DemoRunResult(token=token, customer_id=customer_id, stages=stages, failed=False)

    async def _run_stage(
        self, token: str, stage: str, call: Callable[[], Awaitable[httpx.Response]]
    ) -> StageOutcome:
        await self._patch_status(token, stage, "running")
        start = time.monotonic()
        try:
            response = await call()
            response.raise_for_status()
            result = response.json()
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            duration_ms = (time.monotonic() - start) * 1000
            error = str(exc)
            logger.warning("demo run: stage=%s token=%s failed: %s", stage, token, error)
            await self._patch_status(token, stage, "failed", detail=error)
            return StageOutcome(stage=stage, status="failed", error=error, duration_ms=duration_ms)

        duration_ms = (time.monotonic() - start) * 1000
        await self._patch_status(token, stage, "completed", result=result)
        return StageOutcome(stage=stage, status="completed", result=result, duration_ms=duration_ms)

    async def _patch_status(
        self, token: str, stage: str, status: str, detail: str | None = None, result: dict | None = None
    ) -> None:
        await self._client.patch(
            f"{self._settings.behavioral_dna_base_url}/tokens/{token}/status",
            json={"stage": stage, "status": status, "detail": detail, "result": result},
            timeout=self._timeout,
        )
