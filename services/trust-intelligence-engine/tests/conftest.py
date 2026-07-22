import pytest

from app.domain.entities import BehavioralProfileSnapshot, GraphOutputSnapshot, TrustEvaluationRequest
from app.domain.ports import EvidenceContext
from app.fusion.engine import EvidenceFusionEngine
from app.providers.behavioral_dna_provider import BehavioralDnaEvidenceProvider
from app.providers.device_trust_provider import DeviceTrustEvidenceProvider
from app.providers.geographic_trust_provider import GeographicTrustEvidenceProvider
from app.providers.historical_trust_provider import HistoricalTrustEvidenceProvider
from app.providers.relationship_trust_provider import RelationshipTrustEvidenceProvider


@pytest.fixture
def request_() -> TrustEvaluationRequest:
    return TrustEvaluationRequest(transaction_id="tx-1", customer_id="cust-1", account_id="acc-1")


@pytest.fixture
def full_profile() -> BehavioralProfileSnapshot:
    return BehavioralProfileSnapshot(
        customer_id="cust-1", behavioral_risk_score=0.2, confidence_score=0.9, history_depth=45, version=45
    )


@pytest.fixture
def full_graph_output() -> GraphOutputSnapshot:
    return GraphOutputSnapshot(entity_id="acc-1", graph_confidence_score=0.8, avg_outgoing_trust_score=0.7)


@pytest.fixture
def full_context(request_, full_profile, full_graph_output) -> EvidenceContext:
    return EvidenceContext(request=request_, profile=full_profile, graph_output=full_graph_output)


@pytest.fixture
def empty_context(request_) -> EvidenceContext:
    return EvidenceContext(request=request_, profile=None, graph_output=None)


@pytest.fixture
def all_providers():
    return [
        BehavioralDnaEvidenceProvider(),
        DeviceTrustEvidenceProvider(),
        GeographicTrustEvidenceProvider(),
        RelationshipTrustEvidenceProvider(),
        HistoricalTrustEvidenceProvider(),
    ]


@pytest.fixture
def fusion_engine() -> EvidenceFusionEngine:
    return EvidenceFusionEngine()
