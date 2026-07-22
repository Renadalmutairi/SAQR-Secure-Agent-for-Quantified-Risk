"""Standalone CLI for the Agent 1 backfill pipeline.

Ops-facing entrypoint for large one-off historical loads: runs detached from the
FastAPI process (no web worker tied up for the duration), same pipeline the API's
POST /profiles/backfill uses under the hood.

Usage:
    python -m app.ingestion.run_backfill [csv_path]
"""

import argparse
import asyncio
import logging
import sys
import uuid

from app.config import Settings, get_settings
from app.wiring import build_container

logger = logging.getLogger(__name__)


async def _report_progress(pipeline, interval_seconds: float) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        snap = pipeline.progress.snapshot()
        mem = f"{snap.memory_rss_mb:.1f}MB" if snap.memory_rss_mb is not None else "n/a"
        print(
            f"[{snap.status}] rows={snap.rows_processed} "
            f"tx/s(overall)={snap.overall_tx_per_sec:.1f} tx/s(recent)={snap.recent_tx_per_sec:.1f} "
            f"mem={mem}",
            flush=True,
        )


async def _run(csv_path: str, settings: Settings) -> int:
    container = await build_container(settings)
    pipeline = container.new_backfill_pipeline(str(uuid.uuid4()), csv_path)
    reporter = asyncio.create_task(_report_progress(pipeline, settings.backfill_progress_log_interval_seconds))

    try:
        await pipeline.run()
        snap = pipeline.progress.snapshot()
        print(f"done: {snap.rows_processed} rows in {snap.elapsed_seconds:.1f}s "
              f"({snap.overall_tx_per_sec:.1f} tx/s average)")
        return 0
    except Exception:
        logger.exception("backfill failed")
        return 1
    finally:
        reporter.cancel()
        await container.shutdown()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "csv_path", nargs="?", default=None, help="Path to transactions CSV (defaults to SAQR_TRANSACTIONS_CSV_PATH)"
    )
    args = parser.parse_args()
    settings = get_settings()
    csv_path = args.csv_path or settings.transactions_csv_path
    sys.exit(asyncio.run(_run(csv_path, settings)))


if __name__ == "__main__":
    main()
