from app.domain.entities import EvidenceType
from app.fusion.explainer import build_explanation, dominant_factors
from app.fusion.engine import EvidenceFusionEngine
from app.domain.entities import Evidence


def test_dominant_positive_factor_is_highest_scoring_available_evidence(fusion_engine):
    evidences = [
        Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.95, confidence=1.0),
        Evidence(source=EvidenceType.RELATIONSHIP_TRUST, available=True, score=0.6, confidence=1.0),
        Evidence(source=EvidenceType.HISTORICAL_TRUST, available=False),
        Evidence(source=EvidenceType.DEVICE_TRUST, available=False),
        Evidence(source=EvidenceType.GEOGRAPHIC_TRUST, available=False),
    ]
    result = fusion_engine.fuse(evidences)
    positive, negative = dominant_factors(result.contributions)
    assert positive[0] == EvidenceType.BEHAVIORAL_DNA.value
    assert negative == []


def test_dominant_negative_factor_is_lowest_scoring_available_evidence(fusion_engine):
    evidences = [
        Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.1, confidence=1.0),
        Evidence(source=EvidenceType.RELATIONSHIP_TRUST, available=True, score=0.3, confidence=1.0),
        Evidence(source=EvidenceType.HISTORICAL_TRUST, available=False),
        Evidence(source=EvidenceType.DEVICE_TRUST, available=False),
        Evidence(source=EvidenceType.GEOGRAPHIC_TRUST, available=False),
    ]
    result = fusion_engine.fuse(evidences)
    positive, negative = dominant_factors(result.contributions)
    assert negative[0] == EvidenceType.BEHAVIORAL_DNA.value  # lowest score, ranked first among negatives
    assert positive == []


def test_unavailable_evidence_never_appears_in_dominant_factors(fusion_engine):
    evidences = [Evidence(source=t, available=False) for t in EvidenceType]
    result = fusion_engine.fuse(evidences)
    positive, negative = dominant_factors(result.contributions)
    assert positive == []
    assert negative == []


def test_explanation_mentions_missing_evidence_explicitly(fusion_engine):
    evidences = [
        Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.8, confidence=1.0),
        Evidence(source=EvidenceType.DEVICE_TRUST, available=False),
        Evidence(source=EvidenceType.GEOGRAPHIC_TRUST, available=False),
        Evidence(source=EvidenceType.RELATIONSHIP_TRUST, available=False),
        Evidence(source=EvidenceType.HISTORICAL_TRUST, available=False),
    ]
    result = fusion_engine.fuse(evidences)
    missing = [e.source for e in evidences if not e.available]
    explanation = build_explanation(result.trust_score, result.confidence_level, result.contributions, missing)
    assert "device_trust" in explanation
    assert "geographic_trust" in explanation
    assert "relationship_trust" in explanation
    assert "historical_trust" in explanation


def test_explanation_reports_trust_score_and_confidence_numerically(fusion_engine):
    evidences = [Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.75, confidence=1.0)] + [
        Evidence(source=t, available=False)
        for t in EvidenceType
        if t != EvidenceType.BEHAVIORAL_DNA
    ]
    result = fusion_engine.fuse(evidences)
    explanation = build_explanation(result.trust_score, result.confidence_level, result.contributions, [])
    assert f"{result.trust_score:.2f}" in explanation
    assert f"{result.confidence_level:.2f}" in explanation
