import logging
from collections.abc import AsyncIterator

import orjson
from aiokafka import AIOKafkaConsumer

from app.domain.entities import RawTransactionEvent
from app.domain.ports import RawTransactionSource

logger = logging.getLogger(__name__)


class KafkaRawTransactionSource(RawTransactionSource):
    def __init__(self, bootstrap_servers: str, topic: str, group_id: str) -> None:
        self._bootstrap_servers = bootstrap_servers
        self._topic = topic
        self._group_id = group_id

    async def stream(self) -> AsyncIterator[RawTransactionEvent]:
        consumer = AIOKafkaConsumer(
            self._topic,
            bootstrap_servers=self._bootstrap_servers,
            group_id=self._group_id,
            auto_offset_reset="earliest",
            enable_auto_commit=True,
        )
        await consumer.start()
        try:
            async for msg in consumer:
                # Same rule as the behavioral annotation consumer: one bad
                # message must never permanently kill this consumer.
                try:
                    event = RawTransactionEvent(**orjson.loads(msg.value))
                except Exception:
                    logger.exception("skipping unparseable raw transaction at offset %s", msg.offset)
                    continue
                yield event
        finally:
            await consumer.stop()
