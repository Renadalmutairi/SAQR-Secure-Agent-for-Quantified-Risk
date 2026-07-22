import pytest

from app.domain.entities import BehavioralSnapshot, ComplianceSnapshot, Decision, GraphSnapshot, RiskLevel, TrustSnapshot
from app.domain.ports import BehavioralDnaClient, ComplianceClient, GraphIntelligenceClient, TrustIntelligenceClient
from app.fusion.config import RiskThresholds
from app.fusion.engine import RiskFusionEngine
from app.service import DecisionEvaluationService


class FakeBehavioralClient(BehavioralDnaClient):
    def __init__(self, profile: BehavioralSnapshot | None) -> None:
        self._profile = profile

    async def get_profile(self, customer_id: str) -> BehavioralSnapshot | None:
        return self._profile


class FakeGraphClient(GraphIntelligenceClient):
    def __init__(self, output: GraphSnapshot | None) -> None:
        self._output = output

    async def get_output(self, account_id: str) -> GraphSnapshot | None:
        return self._output


class FakeTrustClient(TrustIntelligenceClient):
    def __init__(self, snapshot: TrustSnapshot | None) -> None:
        self._snapshot = snapshot

    async def evaluate_trust(self, transaction_id: str, customer_id: str, account_id: str) -> TrustSnapshot | None:
        return self._snapshot


class FakeComplianceClient(ComplianceClient):
    def __init__(self, snapshot: ComplianceSnapshot | None) -> None:
        self._snapshot = snapshot

    async def evaluate_compliance(self, request) -> ComplianceSnapshot | None:
        return self._snapshot


def _service(behavioral=None, graph=None, trust=None, compliance=None) -> DecisionEvaluationService:
    return DecisionEvaluationService(
        behavioral_client=FakeBehavioralClient(behavioral),
        graph_client=FakeGraphClient(graph),
        trust_client=FakeTrustClient(trust),
        compliance_client=FakeComplianceClient(compliance),
        fusion_engine=RiskFusionEngine(),
        risk_thresholds=RiskThresholds(),
    )


@pytest.mark.asyncio
async def test_full_evaluation_with_all_agents_available(
    request_, low_risk_behavioral, low_risk_graph, high_trust, clean_compliance
):
    service = _service(low_risk_behavioral, low_risk_graph, high_trust, clean_compliance)
    output = await service.evaluate(request_)

    assert output.transaction_id == "tx-1"
    assert output.decision == Decision.APPROVE
    assert output.risk_level == RiskLevel.LOW
    assert len(output.contributing_agents) == 4


@pytest.mark.asyncio
async def test_all_agents_unavailable_still_returns_a_result(request_):
    service = _service()
    output = await service.evaluate(request_)

    assert output.decision_confidence == 0.0
    assert output.overall_risk_score == 0.0
    assert output.decision == Decision.APPROVE  # score 0.0 -> LOW -> APPROVE, but confidence flags it as unreliable
    assert output.contributing_agents == []


@pytest.mark.asyncio
async def test_blocking_compliance_forces_reject_even_with_glowing_other_evidence(
    request_, low_risk_behavioral, low_risk_graph, high_trust, blocking_compliance
):
    service = _service(low_risk_behavioral, low_risk_graph, high_trust, blocking_compliance)
    output = await service.evaluate(request_)

    assert output.decision == Decision.REJECT
    assert output.risk_level == RiskLevel.CRITICAL
    assert "AML-CDD-007" in "".join(output.negative_factors)


@pytest.mark.asyncio
async def test_unknown_account_realistic_degradation_never_falsely_approves(
    request_, zero_confidence_graph, zero_confidence_trust
):
    """Reproduces the exact bug class found in Agent 4's end-to-end testing:
    Agent 2 and Agent 3 both return real, non-null, zero-valued objects for
    an unknown account/customer (their designed graceful-degradation
    behavior), not None. Those must be excluded from fusion, not read as
    'confirmed low risk'."""
    service = _service(behavioral=None, graph=zero_confidence_graph, trust=zero_confidence_trust, compliance=None)
    output = await service.evaluate(request_)

    assert output.contributing_agents == []
    assert output.decision_confidence == 0.0


@pytest.mark.asyncio
async def test_conflicting_evidence_from_spec_example_produces_weighed_review(
    request_, high_risk_behavioral, low_risk_graph, high_trust, clean_compliance
):
    """The exact conflicting-evidence example from the spec: behavioral
    high, graph low, trust high, compliance clean. Must not blindly reject
    or approve."""
    service = _service(high_risk_behavioral, low_risk_graph, high_trust, clean_compliance)
    output = await service.evaluate(request_)

    assert output.decision != Decision.REJECT
    assert output.decision != Decision.APPROVE
    assert len(output.contributing_agents) == 4


@pytest.mark.asyncio
async def test_output_schema_matches_contract(
    request_, low_risk_behavioral, low_risk_graph, high_trust, clean_compliance
):
    service = _service(low_risk_behavioral, low_risk_graph, high_trust, clean_compliance)
    output = await service.evaluate(request_)
    dumped = output.model_dump()
    expected_fields = {
        "transaction_id",
        "customer_id",
        "decision",
        "risk_level",
        "overall_risk_score",
        "decision_confidence",
        "reasoning",
        "contributing_agents",
        "positive_factors",
        "negative_factors",
        "evidence_breakdown",
        "generated_at",
        "schema_version",
    }
    assert expected_fields == set(dumped.keys())


@pytest.mark.asyncio
async def test_output_never_leaks_upstream_internal_fields(
    request_, low_risk_behavioral, low_risk_graph, high_trust, clean_compliance
):
    service = _service(low_risk_behavioral, low_risk_graph, high_trust, clean_compliance)
    output = await service.evaluate(request_)
    dumped = output.model_dump()
    assert "behavioral_dna_vector" not in dumped
    assert "graph_embedding" not in dumped
    assert "dna_vector" not in dumped
