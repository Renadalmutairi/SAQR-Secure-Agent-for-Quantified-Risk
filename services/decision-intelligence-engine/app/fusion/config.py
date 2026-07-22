from dataclasses import dataclass


@dataclass
class FusionWeights:
    behavioral: float = 0.30
    graph: float = 0.25
    trust: float = 0.25
    compliance: float = 0.20

    def total(self) -> float:
        return self.behavioral + self.graph + self.trust + self.compliance


@dataclass
class RiskThresholds:
    """Upper bound (exclusive) of each band; anything >= high goes CRITICAL."""

    low: float = 0.25
    medium: float = 0.50
    high: float = 0.75
