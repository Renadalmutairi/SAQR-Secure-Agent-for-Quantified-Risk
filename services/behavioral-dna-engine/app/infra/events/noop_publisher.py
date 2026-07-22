import asyncio
from collections.abc import Awaitable

from app.domain.entities import DnaOutput
from app.domain.ports import EventPublisher


class NoOpPublisher(EventPublisher):
    """Used in tests and local dev without Kafka. Captures outputs for assertions
    instead of publishing them, so pipeline tests don't need a broker."""

    def __init__(self) -> None:
        self.published: list[DnaOutput] = []

    async def publish_dna_output(self, output: DnaOutput) -> None:
        self.published.append(output)

    async def send_nowait(self, output: DnaOutput) -> Awaitable:
        self.published.append(output)
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        future.set_result(None)
        return future
