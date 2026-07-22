"""One-shot ingestion gateway: reads transactions.csv and publishes each row as a
RawTransactionEvent to Kafka, standing in for a real Core Banking event feed.

Both Agent 1 (via its KafkaTransactionSource adapter) and Agent 2 consume this
topic independently - this is the single shared ingestion point rather than each
agent re-parsing the CSV itself.
"""

import asyncio
import csv
import logging
import time

import orjson
from aiokafka import AIOKafkaProducer

from app.config import get_settings
from app.schema import parse_row

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def run() -> None:
    settings = get_settings()
    producer = AIOKafkaProducer(bootstrap_servers=settings.kafka_bootstrap_servers, acks=1, linger_ms=20)
    await producer.start()

    start = time.monotonic()
    count = 0
    pending_futures = []

    try:
        with open(settings.transactions_csv_path, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                event = parse_row(row)
                payload = orjson.dumps(event.model_dump(mode="json"))
                future = await producer.send(
                    settings.raw_tx_topic, value=payload, key=event.sender_account_id.encode("utf-8")
                )
                pending_futures.append(future)
                count += 1

                if len(pending_futures) >= settings.publish_batch_size:
                    await asyncio.gather(*pending_futures)
                    pending_futures = []

                if count % settings.progress_log_every == 0:
                    elapsed = time.monotonic() - start
                    logger.info("published %s rows (%.1f tx/s)", count, count / elapsed)

            if pending_futures:
                await asyncio.gather(*pending_futures)

        elapsed = time.monotonic() - start
        logger.info("done: published %s rows in %.1fs (%.1f tx/s average)", count, elapsed, count / elapsed)
    finally:
        await producer.stop()


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
