import asyncio
import logging

from app.domain.ports import BehavioralAnnotationSource, RawTransactionSource
from app.graph.cold_path import ColdPathRunner
from app.graph.hot_path import HotPathProcessor

logger = logging.getLogger(__name__)


async def run_raw_tx_consumer(source: RawTransactionSource, hot_path: HotPathProcessor) -> None:
    async for event in source.stream():
        try:
            await hot_path.process_raw_transaction(event)
        except Exception:
            logger.exception("failed to process raw transaction %s", event.tx_id)


async def run_behavioral_annotation_consumer(source: BehavioralAnnotationSource, hot_path: HotPathProcessor) -> None:
    async for annotation in source.stream():
        try:
            await hot_path.process_behavioral_annotation(annotation)
        except Exception:
            logger.exception("failed to process behavioral annotation for tx %s", annotation.transaction_id)


async def run_cold_path_scheduler(cold_path: ColdPathRunner, interval_seconds: float) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await cold_path.run_once()
        except Exception:
            logger.exception("cold path cycle failed")
