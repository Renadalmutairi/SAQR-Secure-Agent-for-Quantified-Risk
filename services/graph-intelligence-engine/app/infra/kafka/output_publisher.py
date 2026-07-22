import orjson
from aiokafka import AIOKafkaProducer

from app.domain.entities import GraphIntelligenceOutput
from app.domain.ports import OutputPublisher


class KafkaOutputPublisher(OutputPublisher):
    def __init__(self, producer: AIOKafkaProducer, topic: str) -> None:
        self._producer = producer
        self._topic = topic

    async def publish(self, output: GraphIntelligenceOutput) -> None:
        payload = orjson.dumps(output.model_dump(mode="json"))
        await self._producer.send_and_wait(self._topic, value=payload, key=output.entity_id.encode("utf-8"))
