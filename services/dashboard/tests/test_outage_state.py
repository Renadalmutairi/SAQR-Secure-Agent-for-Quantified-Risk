from app.benchmark.token_benchmark import OutageState


def test_contains_false_before_any_outage():
    outage = OutageState()
    assert outage.contains(100.0) is False


def test_contains_true_while_outage_open_ended():
    outage = OutageState()
    outage.start = 50.0
    assert outage.contains(60.0) is True
    assert outage.contains(40.0) is False


def test_contains_true_only_within_closed_window():
    outage = OutageState()
    outage.start = 50.0
    outage.end = 70.0
    assert outage.contains(60.0) is True
    assert outage.contains(80.0) is False
    assert outage.contains(40.0) is False


def test_mark_start_clears_previous_end():
    outage = OutageState()
    outage.mark_start()
    outage.mark_end()
    assert outage.end is not None
    outage.mark_start()
    assert outage.end is None
