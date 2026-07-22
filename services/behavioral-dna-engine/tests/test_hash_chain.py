from datetime import UTC, datetime

import pytest

from app.domain.entities import TransactionEvent


def _event(i: int) -> TransactionEvent:
    return TransactionEvent(
        tx_id=str(i), sender_account_id="acc-1", receiver_account_id="acc-2",
        tx_type="TRANSFER", amount=100.0 + i, occurred_at=datetime.now(UTC), raw_timestamp_step=i,
    )


@pytest.mark.asyncio
async def test_untampered_chain_is_intact(service, customer_accounts):
    for i in range(4):
        await service.score_transaction(_event(i))
    customer = await customer_accounts.customer_for_account("acc-1")
    assert await service.verify_audit_trail(customer.customer_id) is True


@pytest.mark.asyncio
async def test_tampering_with_a_historical_version_breaks_the_chain(service, profiles, customer_accounts):
    for i in range(4):
        await service.score_transaction(_event(i))
    customer = await customer_accounts.customer_for_account("acc-1")

    # Simulate someone editing history directly in storage, bypassing append_version.
    tampered = profiles._history[customer.customer_id][0].model_copy(
        update={"behavioral_risk_score": 0.9999}
    )
    profiles._history[customer.customer_id][0] = tampered

    assert await service.verify_audit_trail(customer.customer_id) is False


@pytest.mark.asyncio
async def test_each_version_links_to_its_predecessor(service, profiles, customer_accounts):
    for i in range(3):
        await service.score_transaction(_event(i))
    customer = await customer_accounts.customer_for_account("acc-1")
    history = list(reversed(await profiles.get_history(customer.customer_id, limit=100)))  # oldest first

    assert history[0].prev_version_hash is None
    for prev, curr in zip(history, history[1:]):
        assert curr.prev_version_hash == prev.content_hash
