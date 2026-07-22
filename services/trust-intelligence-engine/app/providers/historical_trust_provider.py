from app.domain.entities import Evidence, EvidenceType, HistoricalSignals
from app.domain.ports import EvidenceContext, EvidenceProvider, HistoricalSignalSource
from app.fusion.stats import saturating_growth

_TOTAL_POSSIBLE_SIGNALS = 5  # keep in sync with HistoricalSignals' field count
_DEFAULT_HISTORY_DEPTH_SCALE = 30.0


class FallbackHistoricalSignalSource(HistoricalSignalSource):
    """Temporary v1 source: only history_depth is wired, from the Agent 1
    profile already in context - no extra HTTP call needed. This is a
    fallback, not the permanent design - swap this class out (for one reading
    previous_trust_score/previous_behavioral_score/previous_structural_score/
    consistency_trend from a real store) once those sources exist, without
    touching HistoricalTrustEvidenceProvider or the fusion engine.
    """

    def get_signals(self, context: EvidenceContext) -> HistoricalSignals:
        history_depth = context.profile.history_depth if context.profile else None
        return HistoricalSignals(history_depth=history_depth)


class HistoricalTrustEvidenceProvider(EvidenceProvider):
    """Computes from whichever of HistoricalSignals' five fields the injected
    HistoricalSignalSource actually populates - never hardcodes history_depth
    itself. With FallbackHistoricalSignalSource (the default), that happens to
    be history_depth alone today, but the provider has no opinion about that;
    swapping the signal source is how richer signals get added later.

    Confidence reflects how many of the 5 possible signal types were actually
    available, not just how precise the ones we have are - deliberately
    conservative: judging "historical trust" from 1 of 5 possible signal
    families should read as lower-confidence than it would with all 5,
    regardless of how reliable that one signal is.
    """

    source = EvidenceType.HISTORICAL_TRUST
    default_weight = 0.10

    def __init__(
        self,
        signal_source: HistoricalSignalSource | None = None,
        history_depth_scale: float = _DEFAULT_HISTORY_DEPTH_SCALE,
    ) -> None:
        self._signal_source = signal_source or FallbackHistoricalSignalSource()
        self._history_depth_scale = history_depth_scale

    def get_evidence(self, context: EvidenceContext) -> Evidence:
        signals = self._signal_source.get_signals(context)
        components: list[float] = []

        if signals.previous_trust_score is not None:
            components.append(signals.previous_trust_score)
        if signals.previous_behavioral_score is not None:
            components.append(signals.previous_behavioral_score)
        if signals.previous_structural_score is not None:
            components.append(signals.previous_structural_score)
        if signals.consistency_trend is not None:
            components.append(signals.consistency_trend)
        if signals.history_depth is not None:
            components.append(saturating_growth(signals.history_depth, self._history_depth_scale))

        if not components:
            return Evidence(source=self.source, available=False, detail="no historical signals available")

        score = sum(components) / len(components)
        confidence = len(components) / _TOTAL_POSSIBLE_SIGNALS
        return Evidence(
            source=self.source,
            available=True,
            score=score,
            confidence=confidence,
            detail=f"{len(components)}/{_TOTAL_POSSIBLE_SIGNALS} historical signal(s); history_depth={signals.history_depth}",
        )
