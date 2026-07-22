"""Cheap, O(1) trigger check for adaptive hop expansion. Uses only numbers the
hot path already computed (fan-in/fan-out/degree) - never runs a traversal just
to decide whether to run a deeper traversal.
"""

from dataclasses import dataclass

from app.graph.stats import saturating_growth


@dataclass
class ComplexityConfig:
    fan_scale: float = 15.0  # fan-in/out to reach ~63% of max complexity contribution
    expansion_threshold: float = 0.75


DEFAULT_COMPLEXITY_CONFIG = ComplexityConfig()


def structural_complexity_score(fan_in: int, fan_out: int, config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG) -> float:
    # A spike in EITHER direction alone is enough to warrant a closer look -
    # a big fan-in (many senders converging) or a big fan-out (one account
    # dispersing to many) are each independently interesting patterns.
    return max(saturating_growth(float(fan_in), config.fan_scale), saturating_growth(float(fan_out), config.fan_scale))


def should_expand_neighborhood(score: float, config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG) -> bool:
    return score >= config.expansion_threshold
