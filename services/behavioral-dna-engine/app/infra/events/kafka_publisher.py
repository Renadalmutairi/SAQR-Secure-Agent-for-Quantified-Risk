from collections.abc import Awaitable

import orjson
from aiokafka import AIOKafkaProducer

from app.domain.entities import DnaOutput
from app.domain.ports import EventPublisher


class KafkaEventPublisher(EventPublisher):
    """Publishes structured Behavioral DNA output for downstream SAQR agents
    (Knowledge Graph Builder next). Keyed by customer_id so all updates for one
    customer land on the same partition, preserving per-customer ordering.
    """

    def __init__(self, producer: AIOKafkaProducer, topic: str) -> None:
        self._producer = producer
        self._topic = topic

    async def publish_dna_output(self, output: DnaOutput) -> None:
        payload = orjson.dumps(output.model_dump(mode="json"))
        await self._producer.send_and_wait(self._topic, value=payload, key=output.customer_id.encode("utf-8"))

    async def send_nowait(self, output: DnaOutput) -> Awaitable:
        """Awaiting producer.send() only performs a cheap local enqueue onto
        aiokafka's internal accumulator (batched in the background per
        linger_ms/batch size) - it does NOT wait for the broker. It returns a
        Future for the actual delivery ack, which the caller batch-awaits later.
        """
        payload = orjson.dumps(output.model_dump(mode="json"))
        return await self._producer.send(self._topic, value=payload, key=output.customer_id.encode("utf-8"))
