import pytest

from app.domain.entities import BehavioralProfileSnapshot, GraphOutputSnapshot, TrustEvaluationRequest
from app.domain.ports import BehavioralDnaClient, GraphIntelligenceClient
from app.fusion.engine import EvidenceFusionEngine
from app.fusion.service import TrustEvaluationService
from app.providers.behavioral_dna_provider import BehavioralDnaEvidenceProvider
from app.providers.device_trust_provider import DeviceTrustEvidenceProvider
from app.providers.geographic_trust_provider import GeographicTrustEvidenceProvider
from app.providers.historical_trust_provider import HistoricalTrustEvidenceProvider
from app.providers.relationship_trust_provider import RelationshipTrustEvidenceProvider


class FakeBehavioralClient(BehavioralDnaClient):
    def __init__(self, profile: BehavioralProfileSnapshot | None) -> None:
        self._profile = profile

    async def get_profile(self, customer_id: str) -> BehavioralProfileSnapshot | None:
        return self._profile


class FakeGraphClient(GraphIntelligenceClient):
    def __init__(self, output: GraphOutputSnapshot | None) -> None:
        self._output = output

    async def get_output(self, account_id: str) -> GraphOutputSnapshot | None:
        return self._output


def _service(profile, output) -> TrustEvaluationService:
    return TrustEvaluationService(
        behavioral_client=FakeBehavioralClient(profile),
        graph_client=FakeGraphClient(output),
        providers=[
            BehavioralDnaEvidenceProvider(),
            DeviceTrustEvidenceProvider(),
            GeographicTrustEvidenceProvider(),
            RelationshipTrustEvidenceProvider(),
            HistoricalTrustEvidenceProvider(),
        ],
        fusion_engine=EvidenceFusionEngine(),
    )


@pytest.mark.asyncio
async def test_full_evaluation_with_both_upstreams_available(full_profile, full_graph_output, request_):
    service = _service(full_profile, full_graph_output)
    output = await service.evaluate(request_)

    assert output.transaction_id == "tx-1"
    assert 0.0 <= output.trust_score <= 1.0
    assert {e.value for e in output.missing_evidence} == {"device_trust", "geographic_trust"}
    assert output.confidence_level > 0.0
    assert "Trust score" in output.explanation


@pytest.mark.asyncio
async def test_agent1_unavailable_degrades_gracefully(full_graph_output, request_):
    service = _service(None, full_graph_output)
    output = await service.evaluate(request_)

    missing_values = {e.value for e in output.missing_evidence}
    assert "behavioral_dna" in missing_values
    assert "historical_trust" in missing_values  # also depends on the same profile fetch
    assert "relationship_trust" not in missing_values
    assert output.trust_score >= 0.0  # never raises, always returns a result


@pytest.mark.asyncio
async def test_agent2_unavailable_degrades_gracefully(full_profile, request_):
    service = _service(full_profile, None)
    output = await service.evaluate(request_)

    missing_values = {e.value for e in output.missing_evidence}
    assert "relationship_trust" in missing_values
    assert "behavioral_dna" not in missing_values


@pytest.mark.asyncio
async def test_both_upstreams_unavailable_still_returns_a_result(request_):
    service = _service(None, None)
    output = await service.evaluate(request_)

    assert output.trust_score == 0.0
    assert output.confidence_level == 0.0
    assert len(output.missing_evidence) == 5


@pytest.mark.asyncio
async def test_output_never_leaks_upstream_internal_fields(full_profile, full_graph_output, request_):
    """The output contract must only ever contain fused/derived values - never
    raw pass-through of Agent 1/2 internal fields (e.g. dna_vector, embeddings)."""
    service = _service(full_profile, full_graph_output)
    output = await service.evaluate(request_)
    dumped = output.model_dump()
    assert "dna_vector" not in dumped
    assert "graph_embedding" not in dumped
    assert "behavioral_dna_vector" not in dumped
