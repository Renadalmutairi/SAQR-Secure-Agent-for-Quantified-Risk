import statistics

from app.domain.entities import WelfordState
from app.graph.stats import (
    coefficient_of_variation,
    consistency_from_cv,
    exponential_decay,
    ewma_update,
    saturating_growth,
    welford_update,
)


def test_welford_matches_naive_mean_and_variance():
    values = [10.0, 12.0, 23.0, 9.0, 41.0, 15.0, 5.0]
    state = WelfordState()
    for v in values:
        state = welford_update(state, v)

    assert state.count == len(values)
    assert state.mean == statistics.mean(values)
    assert abs((state.m2 / state.count) - statistics.pvariance(values)) < 1e-9


def test_coefficient_of_variation_none_when_insufficient_history():
    assert coefficient_of_variation(WelfordState()) is None
    assert coefficient_of_variation(WelfordState(count=1, mean=5.0, m2=0.0)) is None


def test_coefficient_of_variation_zero_for_perfectly_regular_values():
    state = WelfordState()
    for v in [100.0, 100.0, 100.0, 100.0]:
        state = welford_update(state, v)
    assert coefficient_of_variation(state) == 0.0


def test_consistency_from_cv_perfect_regularity_is_one():
    assert consistency_from_cv(0.0) == 1.0


def test_consistency_from_cv_none_returns_neutral_default():
    assert consistency_from_cv(None) == 0.5
    assert consistency_from_cv(None, neutral_default=0.3) == 0.3


def test_consistency_from_cv_decreases_as_variability_increases():
    assert consistency_from_cv(1.0) < consistency_from_cv(0.1)


def test_ewma_first_value_has_no_prior():
    assert ewma_update(None, 0.7, alpha=0.3) == 0.7


def test_ewma_weights_recent_value_by_alpha():
    result = ewma_update(previous=0.2, new_value=1.0, alpha=0.5)
    assert result == 0.5 * 1.0 + 0.5 * 0.2


def test_exponential_decay_is_one_at_zero_elapsed():
    assert exponential_decay(0.0, half_life_seconds=100.0) == 1.0


def test_exponential_decay_is_half_at_half_life():
    result = exponential_decay(100.0, half_life_seconds=100.0)
    assert abs(result - 0.5) < 1e-9


def test_exponential_decay_approaches_zero_for_large_elapsed():
    assert exponential_decay(100_000.0, half_life_seconds=100.0) < 0.001


def test_saturating_growth_zero_at_zero():
    assert saturating_growth(0.0, scale=10.0) == 0.0


def test_saturating_growth_bounded_below_one():
    # A large-but-not-absurd input: big enough to approach the asymptote, small
    # enough that 1 - exp(-x) is still distinguishable from 1.0 in float64
    # (exp(-x) underflows to ~0 for x gtrsim 40, at which point 1-exp(-x) rounds
    # to exactly 1.0 regardless of the function's own correctness).
    assert saturating_growth(100.0, scale=10.0) < 1.0
    assert saturating_growth(100.0, scale=10.0) > 0.999


def test_saturating_growth_monotonically_increasing():
    values = [saturating_growth(x, scale=10.0) for x in [0, 5, 10, 20, 50]]
    assert values == sorted(values)
