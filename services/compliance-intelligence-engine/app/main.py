import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import compliance, health
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
        title="SAQR Agent 4 - Compliance Intelligence Engine",
        description=(
            "Regulatory compliance layer: evaluates each transaction against a "
            "configurable, bank-agnostic Policy Registry (SAMA, AMLPC, CMA, Basel, "
            "Wolfsberg, plus institution-specific extensions) using Agent 1 "
            "(behavioral), Agent 2 (structural), and Agent 3 (trust) signals. "
            "Does not detect fraud, does not compute risk scores - reports rule "
            "verdicts (passed/violated/unevaluated), never a false pass."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(health.router)
    app.include_router(compliance.router)
    return app


app = create_app()
