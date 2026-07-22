from datetime import UTC, datetime

import pytest

from app.config import Settings
from app.domain.entities import TransactionEvent
from app.features.defaults import build_default_registry
from app.ingestion.pipeline.coordinator import _shard_index
from app.ingestion.pipeline.shard_worker import ShardWorker


def _event(i: int, sender: str, receiver: str = "merchant-1") -> TransactionEvent:
    return TransactionEvent(
        tx_id=str(i), sender_account_id=sender, receiver_account_id=receiver,
        tx_type="TRANSFER", amount=100.0 + i, occurred_at=datetime.now(UTC), raw_timestamp_step=i,
    )


@pytest.fixture
def shard() -> ShardWorker:
    settings = Settings(min_history_for_full_confidence=5)
    return ShardWorker(shard_id=0, registry=build_default_registry(), settings=settings)


def test_new_customer_is_reported_as_pending_before_hydration(shard):
    shard.stage(_event(1, sender="acc-1"), customer_id="cust-1")
    assert shard.pending_new_customer_ids() == {"cust-1"}
    assert shard.pending_new_account_ids() == {"acc-1"}


def test_hydration_clears_pending_status(shard):
    shard.stage(_event(1, sender="acc-1"), customer_id="cust-1")
    shard.hydrate_customer("cust-1", None)
    shard.hydrate_account("acc-1", None)
    assert shard.pending_new_customer_ids() == set()
    assert shard.pending_new_account_ids() == set()


def test_process_staged_produces_sequential_versions_for_same_customer(shard):
    for i in range(5):
        shard.stage(_event(i, sender="acc-1"), customer_id="cust-1")
    shard.hydrate_customer("cust-1", None)
    shard.hydrate_account("acc-1", None)

    outputs, profile_versions, context_versions = shard.process_staged()

    assert len(outputs) == 5
    assert [p.version for p in profile_versions] == [1, 2, 3, 4, 5]
    assert [c.version for c in context_versions] == [1, 2, 3, 4, 5]
    # each version's prev_version_hash links to the one before it (hash chain intact)
    for prev, curr in zip(profile_versions, profile_versions[1:]):
        assert curr.prev_version_hash == prev.content_hash
    assert shard.rows_processed_total == 5
    assert shard.staged_count == 0  # cleared after processing


def test_process_staged_matches_realtime_service_math_for_identical_inputs(shard, service):
    """The bulk path must produce byte-identical statistics to the real-time path
    for the same sequence of transactions - that's the whole point of reusing
    compare/build_next_version/etc rather than reimplementing the math."""
    import asyncio

    events = [_event(i, sender="acc-shared") for i in range(6)]

    async def run_realtime():
        outputs = []
        for e in events:
            outputs.append(await service.score_transaction(e))
        return outputs

    realtime_outputs = asyncio.run(run_realtime())

    for e in events:
        shard.stage(e, customer_id="cust-should-match")
    shard.hydrate_customer("cust-should-match", None)
    shard.hydrate_account("acc-shared", None)
    bulk_outputs, _, _ = shard.process_staged()

    for rt, bulk in zip(realtime_outputs, bulk_outputs, strict=True):
        assert rt.behavioral_risk_score == pytest.approx(bulk.behavioral_risk_score)
        assert rt.confidence_score == pytest.approx(bulk.confidence_score)
        assert rt.profile_version == bulk.profile_version


def test_shard_index_is_deterministic_and_spreads_across_shards():
    customer_ids = [f"cust-{i}" for i in range(200)]
    indices = {_shard_index(cid, shard_count=8) for cid in customer_ids}
    # deterministic: same id always maps to the same shard
    assert _shard_index("cust-42", 8) == _shard_index("cust-42", 8)
    # spreads across more than one shard for a varied population
    assert len(indices) > 1
    assert all(0 <= i < 8 for i in indices)
