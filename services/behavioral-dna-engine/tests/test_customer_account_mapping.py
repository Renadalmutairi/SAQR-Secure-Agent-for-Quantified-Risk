from datetime import UTC, datetime

import pytest

from app.domain.entities import CustomerAccountLink, OwnershipRole, TransactionEvent


def _event(i: int, sender: str) -> TransactionEvent:
    return TransactionEvent(
        tx_id=str(i), sender_account_id=sender, receiver_account_id="merchant-1",
        tx_type="TRANSFER", amount=100.0 + i, occurred_at=datetime.now(UTC), raw_timestamp_step=i,
    )


@pytest.mark.asyncio
async def test_unlinked_accounts_get_independent_customers(service, customer_accounts):
    await service.score_transaction(_event(0, sender="acc-A"))
    await service.score_transaction(_event(1, sender="acc-B"))

    customer_a = await customer_accounts.customer_for_account("acc-A")
    customer_b = await customer_accounts.customer_for_account("acc-B")
    assert customer_a.customer_id != customer_b.customer_id


@pytest.mark.asyncio
async def test_one_customer_with_multiple_accounts_shares_one_behavioral_dna(
    service, profiles, customer_accounts
):
    now = datetime.now(UTC)
    await customer_accounts.link(
        CustomerAccountLink(customer_id="cust-shared", account_id="acc-checking", role=OwnershipRole.OWNER, linked_at=now)
    )
    await customer_accounts.link(
        CustomerAccountLink(customer_id="cust-shared", account_id="acc-savings", role=OwnershipRole.OWNER, linked_at=now)
    )

    await service.score_transaction(_event(0, sender="acc-checking"))
    await service.score_transaction(_event(1, sender="acc-savings"))
    await service.score_transaction(_event(2, sender="acc-checking"))

    profile = await service.get_profile("cust-shared")
    assert profile is not None
    # 3 transactions across 2 accounts all landed on ONE customer-level profile
    assert profile.history_depth == 3
    assert profile.version == 3


@pytest.mark.asyncio
async def test_account_level_context_stays_independent_per_account(service, profiles, customer_accounts):
    now = datetime.now(UTC)
    await customer_accounts.link(
        CustomerAccountLink(customer_id="cust-shared-2", account_id="acc-x", role=OwnershipRole.OWNER, linked_at=now)
    )
    await customer_accounts.link(
        CustomerAccountLink(customer_id="cust-shared-2", account_id="acc-y", role=OwnershipRole.OWNER, linked_at=now)
    )

    await service.score_transaction(_event(0, sender="acc-x"))
    await service.score_transaction(_event(1, sender="acc-x"))
    await service.score_transaction(_event(2, sender="acc-y"))

    ctx_x = await service.get_account_context("acc-x")
    ctx_y = await service.get_account_context("acc-y")

    assert ctx_x.history_depth == 2
    assert ctx_y.history_depth == 1
    # customer-level DNA aggregated across both accounts
    customer_profile = await service.get_profile("cust-shared-2")
    assert customer_profile.history_depth == 3
