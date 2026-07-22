import time
from collections import deque
from dataclasses import dataclass

try:
    import psutil

    _process: psutil.Process | None = psutil.Process()
except ImportError:  # pragma: no cover - psutil is a pinned dependency, this is a safety net
    _process = None


@dataclass
class ProgressSnapshot:
    run_id: str
    rows_processed: int
    elapsed_seconds: float
    overall_tx_per_sec: float
    recent_tx_per_sec: float
    memory_rss_mb: float | None
    status: str


class BackfillProgress:
    """Tracks throughput and memory for one backfill run.

    `record()` is called once per generation (in bulk, e.g. n=2000), not once per
    row - a fixed wall-clock "reset the window every N seconds" approach breaks
    under that calling pattern (the window keeps resetting exactly when record()
    is called, so `recent` always looks like "0 progress since the last reset").
    Instead we keep a short trailing history of (time, cumulative_count) samples
    and compute the recent rate from the oldest sample still inside the window -
    correct regardless of how often record() is called.
    """

    def __init__(self, run_id: str, sample_window_seconds: float = 5.0, history_len: int = 20) -> None:
        self.run_id = run_id
        self._start = time.monotonic()
        self._rows_processed = 0
        self._status = "running"
        self._sample_window = sample_window_seconds
        self._samples: deque[tuple[float, int]] = deque(maxlen=history_len)
        self._samples.append((self._start, 0))

    def record(self, n: int) -> None:
        self._rows_processed += n
        self._samples.append((time.monotonic(), self._rows_processed))

    def mark_status(self, status: str) -> None:
        self._status = status

    def snapshot(self) -> ProgressSnapshot:
        now = time.monotonic()
        elapsed = max(now - self._start, 1e-6)
        cutoff = now - self._sample_window

        window_time, window_count = self._samples[0]
        for sample_time, sample_count in self._samples:
            if sample_time < cutoff:
                window_time, window_count = sample_time, sample_count
            else:
                break

        window_elapsed = max(now - window_time, 1e-6)
        recent_count = self._rows_processed - window_count
        memory_rss_mb = (_process.memory_info().rss / (1024 * 1024)) if _process else None

        return ProgressSnapshot(
            run_id=self.run_id,
            rows_processed=self._rows_processed,
            elapsed_seconds=elapsed,
            overall_tx_per_sec=self._rows_processed / elapsed,
            recent_tx_per_sec=recent_count / window_elapsed,
            memory_rss_mb=memory_rss_mb,
            status=self._status,
        )
