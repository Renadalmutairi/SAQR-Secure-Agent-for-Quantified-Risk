from app.domain.entities import Evidence


class EvidenceNormalizer:
    """Runs after EvidenceValidator. Clamps score/confidence into [0,1] as a
    second defensive layer (the validator already rejects genuinely
    out-of-range values; this absorbs float edge cases), and defaults a
    missing quality to 1.0 (full quality) - a provider that hasn't wired a
    quality signal yet must not be penalized relative to one that has.
    """

    def normalize(self, evidence: Evidence) -> Evidence:
        if not evidence.available:
            return evidence

        quality = evidence.quality if evidence.quality is not None else 1.0
        return evidence.model_copy(
            update={
                "score": max(0.0, min(1.0, evidence.score)),
                "confidence": max(0.0, min(1.0, evidence.confidence)),
                "quality": max(0.0, min(1.0, quality)),
            }
        )
