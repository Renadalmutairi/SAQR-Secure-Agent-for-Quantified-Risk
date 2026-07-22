from app.domain.entities import BehavioralProfileSnapshot, EvidenceType, GraphOutputSnapshot
from app.domain.ports import EvidenceContext
from app.providers.behavioral_dna_provider import BehavioralDnaEvidenceProvider
from app.providers.device_trust_provider import DeviceTrustEvidenceProvider
from app.providers.geographic_trust_provider import GeographicTrustEvidenceProvider
from app.providers.historical_trust_provider import HistoricalTrustEvidenceProvider
from app.providers.relationship_trust_provider import RelationshipTrustEvidenceProvider


def test_behavioral_dna_provider_inverts_risk_into_trust(full_context):
    evidence = BehavioralDnaEvidenceProvider().get_evidence(full_context)
    assert evidence.available is True
    assert evidence.source == EvidenceType.BEHAVIORAL_DNA
    assert evidence.score == 0.8  # 1 - 0.2
    assert evidence.confidence == 0.9


def test_behavioral_dna_provider_unavailable_when_profile_missing(empty_context):
    evidence = BehavioralDnaEvidenceProvider().get_evidence(empty_context)
    assert evidence.available is False
    assert evidence.score is None


def test_behavioral_dna_provider_unavailable_when_risk_score_is_none(request_):
    profile = BehavioralProfileSnapshot(
        customer_id="cust-1", behavioral_risk_score=None, confidence_score=0.5, history_depth=1, version=1
    )
    context = EvidenceContext(request=request_, profile=profile, graph_output=None)
    evidence = BehavioralDnaEvidenceProvider().get_evidence(context)
    assert evidence.available is False


def test_relationship_trust_provider_uses_avg_outgoing_trust_score(full_context):
    evidence = RelationshipTrustEvidenceProvider().get_evidence(full_context)
    assert evidence.available is True
    assert evidence.score == 0.7
    assert evidence.confidence == 0.8


def test_relationship_trust_provider_unavailable_when_graph_output_missing(empty_context):
    evidence = RelationshipTrustEvidenceProvider().get_evidence(empty_context)
    assert evidence.available is False


def test_relationship_trust_provider_unavailable_when_no_outgoing_edges(request_):
    output = GraphOutputSnapshot(entity_id="acc-1", graph_confidence_score=0.5, avg_outgoing_trust_score=None)
    context = EvidenceContext(request=request_, profile=None, graph_output=output)
    evidence = RelationshipTrustEvidenceProvider().get_evidence(context)
    assert evidence.available is False


def test_device_trust_provider_always_unavailable(full_context, empty_context):
    assert DeviceTrustEvidenceProvider().get_evidence(full_context).available is False
    assert DeviceTrustEvidenceProvider().get_evidence(empty_context).available is False


def test_geographic_trust_provider_always_unavailable(full_context, empty_context):
    assert GeographicTrustEvidenceProvider().get_evidence(full_context).available is False
    assert GeographicTrustEvidenceProvider().get_evidence(empty_context).available is False


def test_historical_trust_provider_falls_back_to_history_depth(full_context):
    evidence = HistoricalTrustEvidenceProvider().get_evidence(full_context)
    assert evidence.available is True
    assert 0.0 < evidence.score < 1.0
    # only 1 of 5 possible signal families available -> low confidence,
    # regardless of how reliable that one signal is
    assert evidence.confidence == 1 / 5


def test_historical_trust_provider_unavailable_with_no_signals(empty_context):
    evidence = HistoricalTrustEvidenceProvider().get_evidence(empty_context)
    assert evidence.available is False


def test_historical_trust_provider_higher_depth_yields_higher_score(request_):
    low = BehavioralProfileSnapshot(
        customer_id="cust-1", behavioral_risk_score=0.1, confidence_score=0.9, history_depth=2, version=2
    )
    high = BehavioralProfileSnapshot(
        customer_id="cust-1", behavioral_risk_score=0.1, confidence_score=0.9, history_depth=500, version=500
    )
    provider = HistoricalTrustEvidenceProvider()
    low_evidence = provider.get_evidence(EvidenceContext(request=request_, profile=low, graph_output=None))
    high_evidence = provider.get_evidence(EvidenceContext(request=request_, profile=high, graph_output=None))
    assert high_evidence.score > low_evidence.score
