import httpx
import pytest

from app.config import Settings
from app.orchestrator import DemoRunRequest, PipelineOrchestrator


def _settings() -> Settings:
    return Settings(
        behavioral_dna_base_url="http://agent1",
        graph_intelligence_base_url="http://agent2",
        trust_intelligence_base_url="http://agent3",
        compliance_base_url="http://agent4",
        decision_base_url="http://agent5",
    )


def _request() -> DemoRunRequest:
    return DemoRunRequest(account_id="acc-1", receiver_account_id="acc-2", amount=100.0, tx_type="TRANSFER")


class RecordingRouter:
    """Fake transport: records every request, returns a canned/failing response per
    stage based on the configured `fail_stage`. No real network calls."""

    def __init__(self, fail_stage: str | None = None) -> None:
        self.fail_stage = fail_stage
        self.calls: list[tuple[str, str]] = []  # (method, path)

    def handler(self, request: httpx.Request) -> httpx.Response:
        method, path = request.method, request.url.path
        self.calls.append((method, path))

        if path == "/tokens/generate":
            return httpx.Response(200, json={"transaction_id": "SAQR-TX-TEST0001", "customer_id": "cust-1"})
        if path.startswith("/tokens/") and path.endswith("/status"):
            return httpx.Response(200, json={"transaction_id": "SAQR-TX-TEST0001"})

        stage_for_path = {
            "/transactions/score": "behavioral",
            "/accounts/acc-1/output": "graph",
            "/trust/evaluate": "trust",
            "/compliance/evaluate": "compliance",
            "/decision/evaluate": "decision",
        }
        stage = stage_for_path.get(path)
        if stage == self.fail_stage:
            return httpx.Response(500, json={"detail": "simulated failure"})
        if stage == "decision":
            return httpx.Response(200, json={"decision": "APPROVE", "risk_level": "LOW"})
        return httpx.Response(200, json={"stage": stage, "ok": True})


async def _orchestrator(router: RecordingRouter) -> PipelineOrchestrator:
    transport = httpx.MockTransport(router.handler)
    client = httpx.AsyncClient(transport=transport)
    return PipelineOrchestrator(client, _settings())


@pytest.mark.asyncio
async def test_happy_path_runs_all_five_stages_in_order():
    router = RecordingRouter()
    orchestrator = await _orchestrator(router)

    result = await orchestrator.run(_request())

    assert result.failed is False
    assert result.token == "SAQR-TX-TEST0001"
    assert [s.stage for s in result.stages] == ["behavioral", "graph", "trust", "compliance", "decision"]
    assert all(s.status == "completed" for s in result.stages)


@pytest.mark.asyncio
async def test_happy_path_patches_running_then_completed_for_every_stage():
    router = RecordingRouter()
    orchestrator = await _orchestrator(router)
    await orchestrator.run(_request())

    status_patches = [c for c in router.calls if c[0] == "PATCH"]
    # generate (1) + 5 stages * 2 patches (running, completed) = 10 PATCH calls
    assert len(status_patches) == 10


@pytest.mark.asyncio
async def test_stage_failure_halts_remaining_stages():
    router = RecordingRouter(fail_stage="trust")
    orchestrator = await _orchestrator(router)

    result = await orchestrator.run(_request())

    assert result.failed is True
    stage_names = [s.stage for s in result.stages]
    assert stage_names == ["behavioral", "graph", "trust"]  # compliance and decision never ran
    assert result.stages[-1].status == "failed"
    assert result.stages[0].status == "completed"
    assert result.stages[1].status == "completed"


@pytest.mark.asyncio
async def test_failed_stage_is_never_marked_completed():
    router = RecordingRouter(fail_stage="graph")
    orchestrator = await _orchestrator(router)
    result = await orchestrator.run(_request())

    graph_outcome = next(s for s in result.stages if s.stage == "graph")
    assert graph_outcome.status == "failed"
    assert graph_outcome.error is not None

    # behavioral: running+completed (2), graph: running+failed (2) - never a 3rd "completed" patch for graph
    patches = [c for c in router.calls if c[0] == "PATCH"]
    assert len(patches) == 4


@pytest.mark.asyncio
async def test_first_stage_failure_never_calls_downstream_agents():
    router = RecordingRouter(fail_stage="behavioral")
    orchestrator = await _orchestrator(router)
    result = await orchestrator.run(_request())

    assert result.failed is True
    assert len(result.stages) == 1
    called_paths = {c[1] for c in router.calls}
    assert "/accounts/acc-1/output" not in called_paths
    assert "/trust/evaluate" not in called_paths
    assert "/compliance/evaluate" not in called_paths
    assert "/decision/evaluate" not in called_paths
