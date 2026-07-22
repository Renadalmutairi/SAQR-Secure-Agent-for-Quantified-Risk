from app.domain.entities import Evidence, EvidenceType, HistoricalSignals
from app.domain.ports import EvidenceContext, HistoricalSignalSource
from app.providers.historical_trust_provider import FallbackHistoricalSignalSource, HistoricalTrustEvidenceProvider


def test_fusion_engine_includes_quality_in_contribution(fusion_engine):
    evidence = Evidence(
        source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.8, confidence=0.5, quality=0.5
    )
    others = [
        Evidence(source=t, available=False)
        for t in EvidenceType
        if t != EvidenceType.BEHAVIORAL_DNA
    ]
    result = fusion_engine.fuse([evidence, *others])
    contribution = next(c for c in result.contributions if c.source == EvidenceType.BEHAVIORAL_DNA)
    # 0.8 * 0.5 * 0.5 * weight(0.40) = 0.08
    assert contribution.contribution == 0.8 * 0.5 * 0.5 * 0.40


def test_low_quality_evidence_contributes_less_than_full_quality(fusion_engine):
    base = {"source": EvidenceType.BEHAVIORAL_DNA, "available": True, "score": 0.9, "confidence": 1.0}
    low_quality = fusion_engine.fuse([Evidence(**base, quality=0.2)])
    full_quality = fusion_engine.fuse([Evidence(**base, quality=1.0)])
    low_contribution = next(c for c in low_quality.contributions if c.source == EvidenceType.BEHAVIORAL_DNA)
    full_contribution = next(c for c in full_quality.contributions if c.source == EvidenceType.BEHAVIORAL_DNA)
    assert low_contribution.contribution < full_contribution.contribution


def test_missing_quality_defaults_to_full_quality_not_zero(fusion_engine):
    """A provider that hasn't wired a quality signal must not be silently
    zeroed out by the fusion engine - quality=None means 'unknown', which
    defaults to full quality (1.0), not zero contribution."""
    with_quality = fusion_engine.fuse(
        [Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.9, confidence=1.0, quality=1.0)]
    )
    without_quality = fusion_engine.fuse(
        [Evidence(source=EvidenceType.BEHAVIORAL_DNA, available=True, score=0.9, confidence=1.0, quality=None)]
    )
    assert with_quality.trust_score == without_quality.trust_score


class _StubHistoricalSignalSource(HistoricalSignalSource):
    def __init__(self, signals: HistoricalSignals) -> None:
        self._signals = signals

    def get_signals(self, context: EvidenceContext) -> HistoricalSignals:
        return self._signals


def test_historical_trust_provider_uses_injected_signal_source(request_):
    stub = _StubHistoricalSignalSource(HistoricalSignals(previous_trust_score=0.9, history_depth=100))
    provider = HistoricalTrustEvidenceProvider(signal_source=stub)
    context = EvidenceContext(request=request_, profile=None, graph_output=None)

    evidence = provider.get_evidence(context)

    assert evidence.available is True
    # 2 of 5 possible signal slots populated -> confidence reflects that
    assert evidence.confidence == 2 / 5


def test_historical_trust_provider_default_source_is_fallback(full_context):
    """Default construction (no signal_source passed) still works, using
    FallbackHistoricalSignalSource - this is what makes it a fallback rather
    than a hardcoded assumption baked into the provider."""
    provider = HistoricalTrustEvidenceProvider()
    evidence = provider.get_evidence(full_context)
    assert evidence.available is True
    assert evidence.confidence == 1 / 5  # only history_depth is ever populated by the fallback


def test_fallback_signal_source_only_populates_history_depth(full_context):
    source = FallbackHistoricalSignalSource()
    signals = source.get_signals(full_context)
    assert signals.history_depth == full_context.profile.history_depth
    assert signals.previous_trust_score is None
    assert signals.previous_behavioral_score is None
    assert signals.previous_structural_score is None
    assert signals.consistency_trend is None
