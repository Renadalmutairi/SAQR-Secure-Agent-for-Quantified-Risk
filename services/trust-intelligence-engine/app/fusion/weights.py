from dataclasses import dataclass

from app.domain.entities import EvidenceType


@dataclass
class FusionWeights:
    weights: dict[EvidenceType, float]

    def __post_init__(self) -> None:
        total = sum(self.weights.values())
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"FusionWeights must sum to 1.0, got {total}")


DEFAULT_WEIGHTS = FusionWeights(
    weights={
        EvidenceType.BEHAVIORAL_DNA: 0.40,
        EvidenceType.DEVICE_TRUST: 0.20,
        EvidenceType.GEOGRAPHIC_TRUST: 0.15,
        EvidenceType.RELATIONSHIP_TRUST: 0.15,
        EvidenceType.HISTORICAL_TRUST: 0.10,
    }
)
