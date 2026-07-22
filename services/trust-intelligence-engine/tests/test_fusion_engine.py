import pytest

from app.domain.entities import Evidence, EvidenceType
from app.fusion.engine import EvidenceFusionEngine
from app.fusion.weights import DEFAULT_WEIGHTS


def _evidence(source: EvidenceType, score: float, confidence: float) -> Evidence:
    return Evidence(source=source, available=True, score=score, confidence=confidence)


def _unavailable(source: EvidenceType) -> Evidence:
    return Evidence(source=source, available=False)


def test_weights_sum_to_one():
    assert abs(sum(DEFAULT_WEIGHTS.weights.values()) - 1.0) < 1e-9


def test_fusion_engine_rejects_weights_not_summing_to_one():
    import pytest

    from app.fusion.weights import FusionWeights

    with pytest.raises(ValueError):
        FusionWeights(weights={EvidenceType.BEHAVIORAL_DNA: 0.5, EvidenceType.DEVICE_TRUST: 0.4})


def test_all_evidence_available_gives_full_confidence(fusion_engine):
    evidences = [
        _evidence(EvidenceType.BEHAVIORAL_DNA, 0.9, 1.0),
        _evidence(EvidenceType.DEVICE_TRUST, 0.9, 1.0),
        _evidence(EvidenceType.GEOGRAPHIC_TRUST, 0.9, 1.0),
        _evidence(EvidenceType.RELATIONSHIP_TRUST, 0.9, 1.0),
        _evidence(EvidenceType.HISTORICAL_TRUST, 0.9, 1.0),
    ]
    result = fusion_engine.fuse(evidences)
    assert result.confidence_level == pytest.approx(1.0)
    assert result.trust_score == pytest.approx(0.9)  # uniform score/confidence -> trust_score equals it


def test_missing_evidence_is_excluded_not_zeroed(fusion_engine):
    """A missing source must not drag the score toward 0 - it should be
    excluded from the weighted average entirely (renormalized over what's
    actually available), while still being visible in confidence_level."""
    all_high = fusion_engine.fuse(
        [
            _evidence(EvidenceType.BEHAVIORAL_DNA, 0.9, 1.0),
            _evidence(EvidenceType.DEVICE_TRUST, 0.9, 1.0),
            _evidence(EvidenceType.GEOGRAPHIC_TRUST, 0.9, 1.0),
            _evidence(EvidenceType.RELATIONSHIP_TRUST, 0.9, 1.0),
            _evidence(EvidenceType.HISTORICAL_TRUST, 0.9, 1.0),
        ]
    )
    missing_two = fusion_engine.fuse(
        [
            _evidence(EvidenceType.BEHAVIORAL_DNA, 0.9, 1.0),
            _unavailable(EvidenceType.DEVICE_TRUST),
            _unavailable(EvidenceType.GEOGRAPHIC_TRUST),
            _evidence(EvidenceType.RELATIONSHIP_TRUST, 0.9, 1.0),
            _evidence(EvidenceType.HISTORICAL_TRUST, 0.9, 1.0),
        ]
    )
    assert abs(all_high.trust_score - missing_two.trust_score) < 1e-9
    assert missing_two.confidence_level < all_high.confidence_level


def test_confidence_level_reflects_fraction_of_weight_available(fusion_engine):
    # only behavioral (0.40) + relationship (0.15) available = 0.55 of total weight
    evidences = [
        _evidence(EvidenceType.BEHAVIORAL_DNA, 0.8, 1.0),
        _unavailable(EvidenceType.DEVICE_TRUST),
        _unavailable(EvidenceType.GEOGRAPHIC_TRUST),
        _evidence(EvidenceType.RELATIONSHIP_TRUST, 0.8, 1.0),
        _unavailable(EvidenceType.HISTORICAL_TRUST),
    ]
    result = fusion_engine.fuse(evidences)
    assert result.confidence_level == pytest.approx(0.55)


def test_all_evidence_missing_gives_zero_trust_and_zero_confidence(fusion_engine):
    evidences = [_unavailable(t) for t in EvidenceType]
    result = fusion_engine.fuse(evidences)
    assert result.trust_score == 0.0
    assert result.confidence_level == 0.0


def test_low_confidence_evidence_contributes_less_than_high_confidence(fusion_engine):
    low_conf = fusion_engine.fuse(
        [
            _evidence(EvidenceType.BEHAVIORAL_DNA, 0.9, 0.1),
            _unavailable(EvidenceType.DEVICE_TRUST),
            _unavailable(EvidenceType.GEOGRAPHIC_TRUST),
            _unavailable(EvidenceType.RELATIONSHIP_TRUST),
            _unavailable(EvidenceType.HISTORICAL_TRUST),
        ]
    )
    high_conf = fusion_engine.fuse(
        [
            _evidence(EvidenceType.BEHAVIORAL_DNA, 0.9, 1.0),
            _unavailable(EvidenceType.DEVICE_TRUST),
            _unavailable(EvidenceType.GEOGRAPHIC_TRUST),
            _unavailable(EvidenceType.RELATIONSHIP_TRUST),
            _unavailable(EvidenceType.HISTORICAL_TRUST),
        ]
    )
    # trust_score is renormalized by available weight, but the RAW contribution
    # (visible on the breakdown) still reflects the confidence difference
    low_contribution = next(c for c in low_conf.contributions if c.source == EvidenceType.BEHAVIORAL_DNA).contribution
    high_contribution = next(c for c in high_conf.contributions if c.source == EvidenceType.BEHAVIORAL_DNA).contribution
    assert low_contribution < high_contribution
