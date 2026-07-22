import time

from app.ingestion.pipeline.progress import BackfillProgress


def test_recent_tx_per_sec_reflects_bulk_record_calls_not_zero():
    """record() is called once per generation in bulk (e.g. n=2000), not once per
    row - recent_tx_per_sec must not collapse to 0 just because the sampling
    window resets exactly at the moment record() runs."""
    progress = BackfillProgress("run-1", sample_window_seconds=0.05)
    progress.record(100)
    time.sleep(0.06)
    progress.record(100)

    snapshot = progress.snapshot()
    assert snapshot.rows_processed == 200
    assert snapshot.recent_tx_per_sec > 0


def test_overall_tx_per_sec_uses_full_elapsed_time():
    progress = BackfillProgress("run-1")
    progress.record(50)
    snapshot = progress.snapshot()
    assert snapshot.overall_tx_per_sec == snapshot.rows_processed / snapshot.elapsed_seconds


def test_status_defaults_to_running_and_is_settable():
    progress = BackfillProgress("run-1")
    assert progress.snapshot().status == "running"
    progress.mark_status("completed")
    assert progress.snapshot().status == "completed"
