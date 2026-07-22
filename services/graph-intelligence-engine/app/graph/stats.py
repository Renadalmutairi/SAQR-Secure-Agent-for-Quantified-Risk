"""Pure streaming-stats math. No I/O, no Neo4j - mirrors Agent 1's app/profile/stats.py
(same Welford pattern, duplicated rather than imported - separate deployable services)."""

import math

from app.domain.entities import WelfordState


def welford_update(state: WelfordState, new_value: float) -> WelfordState:
    count = state.count + 1
    delta = new_value - state.mean
    mean = state.mean + delta / count
    delta2 = new_value - mean
    m2 = state.m2 + delta * delta2
    return WelfordState(count=count, mean=mean, m2=m2)


def coefficient_of_variation(state: WelfordState) -> float | None:
    """None when there isn't enough history yet to judge regularity."""
    if state.count < 2 or state.mean <= 1e-9:
        return None
    variance = state.m2 / state.count
    stddev = math.sqrt(variance)
    return stddev / state.mean


def consistency_from_cv(cv: float | None, neutral_default: float = 0.5) -> float:
    """Low coefficient of variation (regular, predictable) -> score near 1.
    High CV (erratic) -> score near 0. No data yet -> neutral, not falsely high."""
    if cv is None:
        return neutral_default
    return 1.0 / (1.0 + cv)


def ewma_update(previous: float | None, new_value: float, alpha: float) -> float:
    """Exponentially weighted moving average - recent values matter more than old
    ones, so a relationship's accumulated behavioral signal isn't permanently
    anchored to something that happened once, long ago.
    """
    if previous is None:
        return new_value
    return alpha * new_value + (1 - alpha) * previous


def exponential_decay(elapsed_seconds: float, half_life_seconds: float) -> float:
    """1.0 at elapsed=0, 0.5 at elapsed=half_life, asymptotic to 0 - the decay
    factor applied to edge weight/trust based on recency (last_seen), computed at
    read time and never persisted.
    """
    if half_life_seconds <= 0:
        return 1.0
    return math.exp(-math.log(2) * elapsed_seconds / half_life_seconds)


def saturating_growth(value: float, scale: float) -> float:
    """Grows toward 1 with diminishing returns - used for both interaction-frequency
    and relationship-age components of trust: more/older is better, but a
    relationship doesn't need to be literally infinite to be considered established."""
    if scale <= 0:
        return 1.0 if value > 0 else 0.0
    return 1.0 - math.exp(-value / scale)
