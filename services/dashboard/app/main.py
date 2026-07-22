import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.benchmark_routes import router as benchmark_router
from app.api.routes import router
from app.config import get_settings
from app.wiring import build_container

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    container = build_container(settings)
    app.state.container = container
    try:
        yield
    finally:
        await container.shutdown()


def create_app() -> FastAPI:
    app = FastAPI(
        title="SAQR Dashboard",
        description=(
            "Orchestration and visualization only - not an intelligent agent. Drives the "
            "Token Generation Station demo (Agent 1) and calls Agents 2-5 in sequence, "
            "then serves the operator UI. No scoring, no decisions, no business logic."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    # This service is the intended browser-facing API surface for SAQR (Agents 1-5
    # have none). Wildcard origin is safe here specifically because there is no
    # auth/cookies/credentials anywhere in the stack to leak - if that changes,
    # this must be narrowed to a known origin allowlist.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.include_router(benchmark_router)
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
    return app


app = create_app()
