import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import health, trust
from app.config import get_settings
from app.wiring import build_container

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    container = await build_container(settings)
    app.state.container = container
    try:
        yield
    finally:
        await container.shutdown()


def create_app() -> FastAPI:
    app = FastAPI(
        title="SAQR Agent 3 - Trust Intelligence Engine",
        description=(
            "Evidence fusion layer: combines Behavioral DNA, Device, Geographic, "
            "Relationship, and Historical trust into a single explainable Trust "
            "Score. Does not detect fraud, does not make AML decisions."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(health.router)
    app.include_router(trust.router)
    return app


app = create_app()
