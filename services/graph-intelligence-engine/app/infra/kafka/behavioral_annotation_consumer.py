import logging
from collections.abc import AsyncIterator

import orjson
from aiokafka import AIOKafkaConsumer

from app.domain.entities import BehavioralAnnotation
from app.domain.ports import BehavioralAnnotationSource

logger = logging.getLogger(__name__)


class KafkaBehavioralAnnotationSource(BehavioralAnnotationSource):
    """Consumes Agent 1's DnaOutput stream, parsing only the fields this agent
    needs (see BehavioralAnnotation) - never imports Agent 1's code."""

    def __init__(self, bootstrap_servers: str, topic: str, group_id: str) -> None:
        self._bootstrap_servers = bootstrap_servers
        self._topic = topic
        self._group_id = group_id

    async def stream(self) -> AsyncIterator[BehavioralAnnotation]:
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
                # A single malformed/older-schema message (e.g. published before
                # a contract field was added) must never permanently kill this
                # consumer - skip and keep going, don't let parsing errors
                # propagate out of the loop.
                try:
                    payload = orjson.loads(msg.value)
                    annotation = BehavioralAnnotation(
                        transaction_id=payload["transaction_id"],
                        customer_id=payload["customer_id"],
                        account_id=payload["account_id"],
                        receiver_account_id=payload["receiver_account_id"],
                        behavioral_risk_score=payload["behavioral_risk_score"],
                        confidence_score=payload["confidence_score"],
                        similarity_score=payload["similarity_score"],
                        profile_version=payload["profile_version"],
                        occurred_at=payload["occurred_at"],
                        generated_at=payload["generated_at"],
                    )
                except Exception:
                    logger.exception(
                        "skipping unparseable behavioral annotation at offset %s (likely an older schema version)",
                        msg.offset,
                    )
                    continue
                yield annotation
        finally:
            await consumer.stop()
