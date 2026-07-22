import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import decision, health
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
        title="SAQR Agent 5 - Decision Intelligence Engine",
        description=(
            "The final decision layer of SAQR: fuses Agent 1 (behavioral), "
            "Agent 2 (structural), Agent 3 (trust), and Agent 4 (compliance) "
            "outputs into one explainable, auditable decision. Generates no "
            "new intelligence of its own - compliance violations may override "
            "otherwise-positive evidence when legally required."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(health.router)
    app.include_router(decision.router)
    return app


app = create_app()
