from dataclasses import dataclass

from app.domain.entities import Evidence, EvidenceContribution
from app.fusion.normalizer import EvidenceNormalizer
from app.fusion.validator import EvidenceValidator
from app.fusion.weights import DEFAULT_WEIGHTS, FusionWeights


@dataclass
class FusionResult:
    contributions: list[EvidenceContribution]
    trust_score: float
    confidence_level: float


class EvidenceFusionEngine:
    """Deterministic weighted evidence fusion - no Bayesian networks,
    Dempster-Shafer, or ML models. Kept independent and swappable: a more
    advanced probabilistic fusion strategy could replace `fuse()` later without
    changing TrustIntelligenceOutput or any provider. Depends only on Evidence
    value objects - it has no knowledge of HTTP, Kafka, or any other transport,
    so upstream adapters can change freely without touching this class.

    Every evidence item passes through EvidenceValidator then EvidenceNormalizer
    before fusion, so malformed or unbounded values from any upstream
    implementation can never corrupt the fused score.

    contribution_i = score_i * confidence_i * quality_i * weight_i, for available evidence only
    trust_score = sum(contribution_i) / sum(weight_i for available evidence)
        - renormalized over only the evidence actually present, so missing
          evidence excludes itself rather than silently dragging the score down
    confidence_level = sum(weight_i for available evidence) / sum(all weight_i)
        - how much of the total configured evidence weight was actually backed
          by data for this evaluation
    """

    def __init__(
        self,
        weights: FusionWeights = DEFAULT_WEIGHTS,
        validator: EvidenceValidator | None = None,
        normalizer: EvidenceNormalizer | None = None,
    ) -> None:
        self._weights = weights
        self._validator = validator or EvidenceValidator()
        self._normalizer = normalizer or EvidenceNormalizer()

    def fuse(self, evidences: list[Evidence]) -> FusionResult:
        contributions: list[EvidenceContribution] = []
        available_weight_total = 0.0
        weighted_sum = 0.0

        for raw_evidence in evidences:
            evidence = self._normalizer.normalize(self._validator.validate(raw_evidence))
            weight = self._weights.weights[evidence.source]
            is_usable = (
                evidence.available
                and evidence.score is not None
                and evidence.confidence is not None
                and evidence.quality is not None
            )
            contribution = evidence.score * evidence.confidence * evidence.quality * weight if is_usable else 0.0

            if is_usable:
                weighted_sum += contribution
                available_weight_total += weight

            contributions.append(
                EvidenceContribution(
                    source=evidence.source,
                    available=evidence.available,
                    score=evidence.score,
                    confidence=evidence.confidence,
                    quality=evidence.quality,
                    weight=weight,
                    contribution=contribution,
                )
            )

        total_weight = sum(self._weights.weights.values())
        trust_score = weighted_sum / available_weight_total if available_weight_total > 0 else 0.0
        confidence_level = available_weight_total / total_weight if total_weight > 0 else 0.0

        return FusionResult(contributions=contributions, trust_score=trust_score, confidence_level=confidence_level)
