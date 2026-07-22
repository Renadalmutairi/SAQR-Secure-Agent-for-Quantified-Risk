from __future__ import annotations

import enum
import statistics
from datetime import datetime

from pydantic import BaseModel


class ResultSource(str, enum.Enum):
    """Every number this suite produces carries one of these. MEASURED means it came
    directly out of a real, timed execution against the real backend. PROJECTED means
    it was extrapolated from a smaller measured sample (e.g. full-dataset time from a
    sample's throughput). ESTIMATED means it required an assumption this repo can't
    measure (e.g. a cloud $/hour rate) - the assumption is always stated alongside it.
    Never silently upgraded to a stronger claim than this."""

    MEASURED = "measured"
    PROJECTED = "projected"
    ESTIMATED = "estimated"


class LabeledFloat(BaseModel):
    value: float
    source: ResultSource
    note: str | None = None


class LabeledInt(BaseModel):
    value: int
    source: ResultSource
    note: str | None = None


class LatencyStats(BaseModel):
    """Computed from real captured per-call latencies (milliseconds). The whole block
    is one MEASURED unit - only the containing benchmark result mixes in
    projected/estimated fields where relevant."""

    count: int
    avg_ms: float
    median_ms: float
    p95_ms: float
    p99_ms: float
    min_ms: float
    max_ms: float


def _percentile(sorted_vals: list[float], p: float) -> float:
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    k = (n - 1) * p
    f = int(k)
    c = min(f + 1, n - 1)
    if f == c:
        return sorted_vals[f]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def compute_latency_stats(latencies_ms: list[float]) -> LatencyStats:
    """Pure-stdlib percentile computation (linear-interpolation method) - no numpy
    dependency needed at these sample sizes."""
    if not latencies_ms:
        return LatencyStats(count=0, avg_ms=0.0, median_ms=0.0, p95_ms=0.0, p99_ms=0.0, min_ms=0.0, max_ms=0.0)
    sorted_vals = sorted(latencies_ms)
    return LatencyStats(
        count=len(sorted_vals),
        avg_ms=statistics.fmean(sorted_vals),
        median_ms=statistics.median(sorted_vals),
        p95_ms=_percentile(sorted_vals, 0.95),
        p99_ms=_percentile(sorted_vals, 0.99),
        min_ms=sorted_vals[0],
        max_ms=sorted_vals[-1],
    )


class PipelineBenchmarkResult(BaseModel):
    """Benchmark 1 - real concurrent sample through the existing PipelineOrchestrator
    against the real dataset already in Postgres."""

    sample_size: int
    concurrency: int
    successful: int
    failed: int
    success_rate: float
    latency: LatencyStats
    throughput_tps: LabeledFloat
    per_stage_latency_ms: dict[str, LatencyStats]
    full_dataset_size: int
    full_dataset_projected_seconds: LabeledFloat
    failures: list[str]
    tokens: list[str]
    started_at: datetime
    finished_at: datetime


class TokenBenchmarkResult(BaseModel):
    """Benchmark 2 - real synthetic dataset, real concurrent calls to Agent 1's real
    /tokens/generate. Runs as a background job; this is the polled/final shape."""

    job_id: str
    status: str  # "running" | "completed" | "failed"
    total_requested: int
    total_customers: int
    completed_count: int
    successful: int
    failed: int
    recovered_on_retry: int
    recovery_errors: int
    database_failures: int
    duplicate_tokens: int
    unique_tokens: int
    generation_rate_tps: LabeledFloat
    avg_latency_ms: LabeledFloat
    outage_window: list[datetime] | None
    lost_tokens_checked: int
    lost_tokens_found: int
    started_at: datetime
    finished_at: datetime | None
    tps_samples: list[dict]  # {t: seconds_since_start, tps: float} for the throughput-over-time chart
    full_target_size: int
    full_target_projected_seconds: LabeledFloat | None = None


class TraceabilityResult(BaseModel):
    """Benchmark 3 - re-queries Agent 1's real registry for every token that went
    through Benchmark 1's real pipeline run."""

    tokens_checked: int
    behavioral_completed: int
    graph_completed: int
    trust_completed: int
    compliance_completed: int
    decision_completed: int
    fully_traced: int
    success_rate: float


class DbOperationStats(BaseModel):
    operation: str
    latency: LatencyStats


class DbBenchmarkResult(BaseModel):
    """Benchmark 4 - real timed calls against isolated dbbench- tokens, never mixed
    into Benchmark 1/3's data."""

    sample_size: int
    insert: DbOperationStats
    lookup: DbOperationStats
    update: DbOperationStats
    timeline: DbOperationStats
    substitution_note: str


class CostLineItem(BaseModel):
    label: str
    saqr_value: str
    traditional_value: str
    saqr_source: ResultSource
    traditional_source: ResultSource
    explanation: str


class InfraCostResult(BaseModel):
    """Benchmark 5 - real docker stats + real Postgres size queries (captured
    externally, see infra_cost.py), combined with an explicitly-stated cost formula."""

    captured: bool
    container_stats: list[dict] | None
    database_size_bytes: int | None
    table_metrics: list[dict] | None
    estimated_monthly_cost_usd: LabeledFloat | None
    cost_formula_note: str
    comparison: list[CostLineItem]


class ProductionReadinessItem(BaseModel):
    label: str
    ok: bool
    label_kind: str  # "live-verified" | "present-in-build"
    detail: str


class BenchmarkReport(BaseModel):
    generated_at: datetime
    pipeline: PipelineBenchmarkResult | None = None
    tokens: TokenBenchmarkResult | None = None
    traceability: TraceabilityResult | None = None
    database: DbBenchmarkResult | None = None
    infra_cost: InfraCostResult | None = None
    readiness: list[ProductionReadinessItem] = []
