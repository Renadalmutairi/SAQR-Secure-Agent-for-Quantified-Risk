import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import graph, health
from app.config import get_settings
from app.runners import run_behavioral_annotation_consumer, run_cold_path_scheduler, run_raw_tx_consumer
from app.wiring import build_container

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    container = await build_container(settings)
    app.state.container = container

    tasks = [
        asyncio.create_task(run_raw_tx_consumer(container.raw_tx_source, container.hot_path)),
        asyncio.create_task(run_behavioral_annotation_consumer(container.behavioral_source, container.hot_path)),
        asyncio.create_task(run_cold_path_scheduler(container.cold_path, settings.cold_path_interval_seconds)),
    ]
    logger.info("graph-intelligence-engine started: consumers and cold-path scheduler running")

    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await container.shutdown()


def create_app() -> FastAPI:
    app = FastAPI(
        title="SAQR Agent 2 - Graph Intelligence Engine",
        description=(
            "Maintains a temporal financial knowledge graph and reports structural "
            "intelligence. Does not detect fraud, does not make decisions."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(health.router)
    app.include_router(graph.router)
    return app


app = create_app()
