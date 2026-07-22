from collections.abc import AsyncIterator

import orjson
from aiokafka import AIOKafkaConsumer, TopicPartition

from app.domain.entities import TransactionEvent
from app.domain.ports import TransactionSource


class KafkaTransactionSource(TransactionSource):
    """Reads from the shared saqr.transactions.raw topic (published by the
    Ingestion Gateway) instead of a local CSV file. Same TransactionSource port
    CsvTransactionSource implements - swapping this in is a config change, not a
    rewrite of anything that consumes it (BehavioralDnaService, BackfillPipeline).

    No consumer group / offset commits: each call to stream_historical() does a
    full replay of everything currently in the topic (seek to beginning, read up
    to the offsets captured at call time), matching CsvTransactionSource's
    always-read-everything semantics rather than incremental consumer-group
    tracking, which belongs to the real-time ingestion path, not this one.
    """

    def __init__(self, bootstrap_servers: str, topic: str) -> None:
        self._bootstrap_servers = bootstrap_servers
        self._topic = topic

    def _parse(self, raw: bytes) -> TransactionEvent:
        return TransactionEvent(**orjson.loads(raw))

    async def stream_historical(self) -> AsyncIterator[TransactionEvent]:
        consumer = AIOKafkaConsumer(bootstrap_servers=self._bootstrap_servers, enable_auto_commit=False)
        await consumer.start()
        try:
            partitions = await consumer.partitions_for_topic(self._topic)
            topic_partitions = [TopicPartition(self._topic, p) for p in sorted(partitions)]
            consumer.assign(topic_partitions)
            await consumer.seek_to_beginning(*topic_partitions)
            end_offsets = await consumer.end_offsets(topic_partitions)

            remaining = {tp for tp, end in end_offsets.items() if end > 0}
            while remaining:
                batch = await consumer.getmany(*remaining, timeout_ms=2000)
                if not batch:
                    break
                for tp, messages in batch.items():
                    for msg in messages:
                        yield self._parse(msg.value)
                    if msg.offset + 1 >= end_offsets[tp]:
                        remaining.discard(tp)
        finally:
            await consumer.stop()

    async def transactions_for_account(self, account_id: str) -> list[TransactionEvent]:
        events = [event async for event in self.stream_historical() if event.sender_account_id == account_id]
        return events
