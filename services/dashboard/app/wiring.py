import asyncio
from dataclasses import dataclass, field

import httpx

from app.benchmark.jobs import JobStore
from app.benchmark.token_benchmark import OutageState
from app.config import Settings
from app.orchestrator import PipelineOrchestrator


@dataclass
class Container:
    settings: Settings
    http_client: httpx.AsyncClient
    orchestrator: PipelineOrchestrator
    jobs: JobStore
    token_benchmark_outage: OutageState
    # Holds references to in-flight background benchmark tasks so asyncio doesn't
    # garbage-collect them mid-run (a well-known create_task gotcha) - discarded once
    # each task finishes.
    background_tasks: set[asyncio.Task] = field(default_factory=set)

    def spawn(self, coro) -> asyncio.Task:
        task = asyncio.create_task(coro)
        self.background_tasks.add(task)
        task.add_done_callback(self.background_tasks.discard)
        return task

    async def shutdown(self) -> None:
        await self.http_client.aclose()


def build_container(settings: Settings) -> Container:
    # Higher connection ceiling than the default (100/20) - Benchmark 2 runs at
    # concurrency up to benchmark_token_default_concurrency against a single agent.
    limits = httpx.Limits(max_connections=200, max_keepalive_connections=50)
    http_client = httpx.AsyncClient(limits=limits)
    orchestrator = PipelineOrchestrator(http_client, settings)
    jobs = JobStore(settings.benchmark_jobs_dir)
    token_benchmark_outage = OutageState()
    return Container(
        settings=settings,
        http_client=http_client,
        orchestrator=orchestrator,
        jobs=jobs,
        token_benchmark_outage=token_benchmark_outage,
    )
