import asyncio
import csv
import queue
import threading
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

from app.domain.entities import TransactionEvent
from app.domain.ports import TransactionSource

# The source CSV's TIMESTAMP column is a synthetic simulation step (observed
# range 0-199), not a real calendar timestamp. We anchor step 0 to an arbitrary
# epoch and treat one step as one hour purely so `occurred_at` is a valid,
# strictly-increasing datetime - no day-of-week/time-of-day meaning should be
# read into it. Swap this for real timestamps the moment the source data has them.
_SYNTHETIC_EPOCH = datetime(2026, 1, 1, tzinfo=UTC)
_STEP_UNIT = timedelta(hours=1)

_SENTINEL_DONE = object()


class CsvTransactionSource(TransactionSource):
    """Reads SAQR's transactions.csv (TX_ID, SENDER_ACCOUNT_ID, RECEIVER_ACCOUNT_ID,
    TX_TYPE, TX_AMOUNT, TIMESTAMP, IS_FRAUD, ALERT_ID).

    IS_FRAUD and ALERT_ID are intentionally never read into TransactionEvent - Agent
    1 must not see fraud labels, or its behavioral baselines would be label-leaked.

    Streaming is byte-offset resumable: `stream_from_offset` never loads the file
    into memory (constant memory regardless of file size) and can restart exactly
    after the last row a caller confirmed as processed, for backfill checkpointing.
    """

    def __init__(self, csv_path: str) -> None:
        self._csv_path = csv_path
        self._fieldnames = self._read_header()

    def _read_header(self) -> list[str]:
        with open(self._csv_path, newline="") as f:
            return next(csv.reader(f))

    def _parse_row(self, values: list[str]) -> TransactionEvent:
        row = dict(zip(self._fieldnames, values, strict=True))
        step = int(row["TIMESTAMP"])
        return TransactionEvent(
            tx_id=row["TX_ID"],
            sender_account_id=row["SENDER_ACCOUNT_ID"],
            receiver_account_id=row["RECEIVER_ACCOUNT_ID"],
            tx_type=row["TX_TYPE"],
            amount=float(row["TX_AMOUNT"]),
            occurred_at=_SYNTHETIC_EPOCH + step * _STEP_UNIT,
            raw_timestamp_step=step,
        )

    def _produce_rows(self, byte_offset: int, out_queue: queue.Queue, stop_event: threading.Event) -> None:
        """Runs in a worker thread. Blocking `queue.put` on a bounded queue gives
        real backpressure: this thread stalls once the async consumer falls behind,
        so we never buffer more than `out_queue.maxsize` rows in memory.
        """
        try:
            with open(self._csv_path, newline="") as f:
                if byte_offset > 0:
                    f.seek(byte_offset)
                else:
                    f.readline()  # skip header
                while True:
                    if stop_event.is_set():
                        return
                    # f.tell() is only valid between readline() calls - binding
                    # csv.reader directly to the file and iterating it disables
                    # tell() entirely (CPython buffers ahead internally), so we
                    # read raw lines ourselves and hand each one to csv.reader
                    # individually to get correct per-row resume offsets.
                    line = f.readline()
                    if not line:
                        break
                    values = next(csv.reader([line]))
                    if not values:
                        continue
                    event = self._parse_row(values)
                    out_queue.put((event, f.tell()))
            out_queue.put(_SENTINEL_DONE)
        except Exception as exc:  # noqa: BLE001 - propagated to the async consumer below
            out_queue.put(exc)

    async def stream_from_offset(
        self, byte_offset: int = 0, queue_maxsize: int = 1000
    ) -> AsyncIterator[tuple[TransactionEvent, int]]:
        """Yields (event, byte_offset_immediately_after_this_row)."""
        out_queue: queue.Queue = queue.Queue(maxsize=queue_maxsize)
        stop_event = threading.Event()
        producer = asyncio.create_task(
            asyncio.to_thread(self._produce_rows, byte_offset, out_queue, stop_event)
        )
        try:
            while True:
                item = await asyncio.to_thread(out_queue.get)
                if item is _SENTINEL_DONE:
                    break
                if isinstance(item, Exception):
                    raise item
                yield item
        finally:
            stop_event.set()
            await producer

    async def stream_historical(self) -> AsyncIterator[TransactionEvent]:
        async for event, _ in self.stream_from_offset(0):
            yield event

    async def transactions_for_account(self, account_id: str) -> list[TransactionEvent]:
        events: list[TransactionEvent] = []
        async for event, _ in self.stream_from_offset(0):
            if event.sender_account_id == account_id:
                events.append(event)
        return events
