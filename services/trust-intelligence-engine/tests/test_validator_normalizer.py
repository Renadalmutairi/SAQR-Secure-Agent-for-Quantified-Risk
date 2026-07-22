from app.domain.entities import Evidence, EvidenceType
from app.fusion.normalizer import EvidenceNormalizer
from app.fusion.validator import EvidenceValidator


def test_validator_passes_through_unavailable_evidence_unchanged():
    evidence = Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=False)
    result = EvidenceValidator().validate(evidence)
    assert result == evidence


def test_validator_demotes_available_evidence_missing_score():
    evidence = Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=None, confidence=0.9)
    result = EvidenceValidator().validate(evidence)
    assert result.available is False
    assert "missing" in result.detail


def test_validator_demotes_out_of_bounds_score():
    evidence = Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=1.5, confidence=0.9)
    result = EvidenceValidator().validate(evidence)
    assert result.available is False


def test_validator_demotes_out_of_bounds_quality():
    evidence = Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.5, confidence=0.9, quality=-0.1)
    result = EvidenceValidator().validate(evidence)
    assert result.available is False


def test_validator_accepts_valid_evidence_without_quality():
    evidence = Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.5, confidence=0.9)
    result = EvidenceValidator().validate(evidence)
    assert result.available is True


def test_normalizer_defaults_missing_quality_to_full_quality():
    evidence = Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.5, confidence=0.9, quality=None)
    result = EvidenceNormalizer().normalize(evidence)
    assert result.quality == 1.0


def test_normalizer_preserves_explicit_quality():
    evidence = Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.5, confidence=0.9, quality=0.6)
    result = EvidenceNormalizer().normalize(evidence)
    assert result.quality == 0.6


def test_normalizer_clamps_borderline_values():
    evidence = Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=1.0000001, confidence=-0.0000001)
    result = EvidenceNormalizer().normalize(evidence)
    assert result.score == 1.0
    assert result.confidence == 0.0


def test_normalizer_passes_through_unavailable_evidence_unchanged():
    evidence = Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=False)
    result = EvidenceNormalizer().normalize(evidence)
    assert result == evidence
