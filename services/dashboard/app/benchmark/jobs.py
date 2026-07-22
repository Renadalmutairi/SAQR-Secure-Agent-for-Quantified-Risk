import asyncio
import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Job:
    job_id: str
    kind: str
    status: str = "running"  # running | completed | failed
    progress: dict[str, Any] = field(default_factory=dict)
    result: dict[str, Any] | None = None
    error: str | None = None
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None


class JobStore:
    """In-memory registry for the long-running benchmarks (pipeline, tokens, db),
    file-backed so results survive a dashboard restart. Not a task queue - jobs are
    plain asyncio tasks within this single process, consistent with 'no background
    workers' elsewhere in SAQR (this is reporting infrastructure for a non-agent
    service, not a new agent capability). Callers must pass already-JSON-safe dicts to
    `result` (e.g. `model.model_dump(mode="json")`), never a raw pydantic model.
    """

    def __init__(self, results_dir: str) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = asyncio.Lock()
        self._results_dir = Path(results_dir)
        self._results_dir.mkdir(parents=True, exist_ok=True)
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        for path in self._results_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text())
                job = Job(**data)
                self._jobs[job.job_id] = job
            except Exception:
                continue

    def _persist(self, job: Job) -> None:
        path = self._results_dir / f"{job.job_id}.json"
        path.write_text(json.dumps(asdict(job), default=str))

    def create(self, kind: str) -> Job:
        job = Job(job_id=str(uuid.uuid4()), kind=kind)
        self._jobs[job.job_id] = job
        self._persist(job)
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def latest(self, kind: str) -> Job | None:
        candidates = [j for j in self._jobs.values() if j.kind == kind]
        if not candidates:
            return None
        return max(candidates, key=lambda j: j.started_at)

    async def update_progress(self, job: Job, progress: dict[str, Any]) -> None:
        async with self._lock:
            job.progress = progress
            self._persist(job)

    async def complete(self, job: Job, result: dict[str, Any]) -> None:
        async with self._lock:
            job.status = "completed"
            job.result = result
            job.finished_at = time.time()
            self._persist(job)

    async def fail(self, job: Job, error: str) -> None:
        async with self._lock:
            job.status = "failed"
            job.error = error
            job.finished_at = time.time()
            self._persist(job)
