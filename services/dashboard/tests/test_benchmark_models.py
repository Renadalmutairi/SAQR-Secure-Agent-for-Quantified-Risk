from app.benchmark.models import compute_latency_stats


def test_empty_list_yields_zeroed_stats():
    stats = compute_latency_stats([])
    assert stats.count == 0
    assert stats.avg_ms == 0.0
    assert stats.p95_ms == 0.0


def test_single_value():
    stats = compute_latency_stats([42.0])
    assert stats.count == 1
    assert stats.avg_ms == 42.0
    assert stats.median_ms == 42.0
    assert stats.p95_ms == 42.0
    assert stats.p99_ms == 42.0
    assert stats.min_ms == 42.0
    assert stats.max_ms == 42.0


def test_known_distribution_percentiles():
    # 1..100 ms - p95 and p99 have well-known values under linear interpolation
    values = [float(i) for i in range(1, 101)]
    stats = compute_latency_stats(values)
    assert stats.count == 100
    assert stats.min_ms == 1.0
    assert stats.max_ms == 100.0
    assert stats.avg_ms == 50.5
    assert stats.median_ms == 50.5
    assert 94.0 <= stats.p95_ms <= 96.0
    assert 98.0 <= stats.p99_ms <= 100.0


def test_p99_never_below_p95():
    values = [1.0, 5.0, 5.0, 5.0, 10.0, 500.0, 12.0, 8.0, 9.0, 7.0]
    stats = compute_latency_stats(values)
    assert stats.p99_ms >= stats.p95_ms
    assert stats.max_ms >= stats.p99_ms
