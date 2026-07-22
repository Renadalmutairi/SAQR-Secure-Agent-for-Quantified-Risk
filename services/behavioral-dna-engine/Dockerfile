FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./

RUN pip install --no-cache-dir .

RUN useradd --create-home --uid 1000 saqr
USER saqr

EXPOSE 8001

# Multi-worker: real production topology, not a benchmark hack. A single worker
# CPU-bottlenecks around ~40 req/s under load (measured live during benchmark tuning -
# Postgres itself sits well under 40% CPU at that point, so the ceiling is Agent 1's
# own Python-level request handling, not the database). Worker count and the
# corresponding per-worker DB pool size (see docker-compose.yml) are sized together so
# workers * pool_size stays safely under Postgres's max_connections.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "3"]
