from datetime import UTC, datetime

import pytest

from app.domain.entities import TransactionEvent


def _event(i: int, sender="acc-1", receiver="acc-2", amount=100.0) -> TransactionEvent:
    return TransactionEvent(
        tx_id=str(i), sender_account_id=sender, receiver_account_id=receiver,
        tx_type="TRANSFER", amount=amount, occurred_at=datetime.now(UTC), raw_timestamp_step=i,
    )


@pytest.mark.asyncio
async def test_each_update_creates_a_new_version_not_an_overwrite(service, profiles, customer_accounts):
    for i in range(5):
        await service.score_transaction(_event(i, amount=100.0 + i))

    customer = await customer_accounts.customer_for_account("acc-1")
    history = await profiles.get_history(customer.customer_id, limit=100)

    assert len(history) == 5
    assert [v.version for v in history] == [5, 4, 3, 2, 1]  # newest first
    # exactly one current version, and it's the latest
    current = [v for v in history if v.is_current]
    assert len(current) == 1
    assert current[0].version == 5


@pytest.mark.asyncio
async def test_superseded_versions_retain_original_content(service, profiles, customer_accounts):
    await service.score_transaction(_event(0, amount=50.0))
    first_version_snapshot = (await service.get_profile((await customer_accounts.customer_for_account("acc-1")).customer_id))

    await service.score_transaction(_event(1, amount=999.0))

    customer = await customer_accounts.customer_for_account("acc-1")
    history = await profiles.get_history(customer.customer_id, limit=100)
    old = next(v for v in history if v.version == 1)

    assert old.is_current is False
    assert old.history_depth == first_version_snapshot.history_depth
    assert old.dna_vector == first_version_snapshot.dna_vector  # content untouched


@pytest.mark.asyncio
async def test_confidence_ramps_up_with_history_depth(service):
    outputs = [await service.score_transaction(_event(i)) for i in range(6)]
    confidences = [o.confidence_score for o in outputs]
    assert confidences == sorted(confidences)  # monotonically non-decreasing
    assert confidences[0] < 1.0
    assert confidences[-1] == 1.0  # min_history_for_full_confidence=5 in test settings
