import pytest

from app.benchmark.jobs import JobStore


@pytest.mark.asyncio
async def test_create_get_roundtrip(tmp_path):
    store = JobStore(str(tmp_path))
    job = store.create("pipeline")
    assert store.get(job.job_id) is job
    assert job.status == "running"


@pytest.mark.asyncio
async def test_update_progress(tmp_path):
    store = JobStore(str(tmp_path))
    job = store.create("tokens")
    await store.update_progress(job, {"completed": 10, "total": 100})
    assert job.progress == {"completed": 10, "total": 100}


@pytest.mark.asyncio
async def test_complete_sets_status_and_result(tmp_path):
    store = JobStore(str(tmp_path))
    job = store.create("db")
    await store.complete(job, {"ok": True})
    assert job.status == "completed"
    assert job.result == {"ok": True}
    assert job.finished_at is not None


@pytest.mark.asyncio
async def test_fail_sets_status_and_error(tmp_path):
    store = JobStore(str(tmp_path))
    job = store.create("pipeline")
    await store.fail(job, "boom")
    assert job.status == "failed"
    assert job.error == "boom"


@pytest.mark.asyncio
async def test_latest_returns_most_recently_started_of_kind(tmp_path):
    store = JobStore(str(tmp_path))
    job1 = store.create("pipeline")
    job1.started_at = 100.0
    job2 = store.create("pipeline")
    job2.started_at = 200.0
    assert store.latest("pipeline").job_id == job2.job_id


@pytest.mark.asyncio
async def test_latest_returns_none_for_unknown_kind(tmp_path):
    store = JobStore(str(tmp_path))
    assert store.latest("nonexistent") is None


@pytest.mark.asyncio
async def test_jobs_survive_reload_from_disk(tmp_path):
    store = JobStore(str(tmp_path))
    job = store.create("tokens")
    await store.complete(job, {"total_requested": 1000})

    reloaded = JobStore(str(tmp_path))
    restored = reloaded.get(job.job_id)
    assert restored is not None
    assert restored.status == "completed"
    assert restored.result == {"total_requested": 1000}
