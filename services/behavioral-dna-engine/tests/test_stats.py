import statistics

from app.profile.stats import deviation_level, welford_update, z_score


def test_welford_matches_naive_mean_and_variance():
    values = [10.0, 12.0, 23.0, 9.0, 41.0, 15.0, 5.0]
    count, mean, m2 = 0, 0.0, 0.0
    for v in values:
        count, mean, m2 = welford_update(count, mean, m2, v)

    assert count == len(values)
    assert mean == statistics.mean(values)
    # population variance = m2 / n
    expected_variance = statistics.pvariance(values)
    assert abs((m2 / count) - expected_variance) < 1e-9


def test_z_score_zero_stddev_is_zero_not_infinite():
    assert z_score(observed=100.0, mean=50.0, stddev=0.0) == 0.0


def test_z_score_sign_reflects_direction():
    assert z_score(observed=60.0, mean=50.0, stddev=10.0) > 0
    assert z_score(observed=40.0, mean=50.0, stddev=10.0) < 0


def test_deviation_level_thresholds():
    assert deviation_level(0.5) == "normal"
    assert deviation_level(1.5) == "moderate"
    assert deviation_level(2.9) == "moderate"
    assert deviation_level(3.0) == "high"
    assert deviation_level(10.0) == "high"
