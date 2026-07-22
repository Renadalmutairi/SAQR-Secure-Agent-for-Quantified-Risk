import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.infra.db.models import AccountModel, CustomerAccountLinkModel, CustomerModel


class WarmCustomerAccountResolver:
    """Bulk-friendly counterpart to CustomerAccountRepository for the backfill path.

    Loads the existing account->customer graph once, resolves new accounts entirely
    in memory (no per-row DB round trip), and only touches Postgres when a batch is
    flushed - in the SAME transaction as the profile writes and checkpoint advance
    for that batch, so a crash never strands a customer/link without the profile
    data that references it (or vice versa).

    Uses the SAME 1-account-per-new-customer placeholder strategy as
    InMemoryCustomerAccountRepository / PostgresCustomerAccountRepository - real
    KYC-based entity resolution replaces this class alone, not its callers.
    """

    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._session_factory = session_factory
        self._account_to_customer: dict[str, str] = {}
        self._pending_customers: dict[str, datetime] = {}
        self._pending_accounts: set[str] = set()
        self._pending_links: list[tuple[str, str, datetime]] = []

    async def warm_up(self) -> None:
        async with self._session_factory() as session:
            stmt = select(CustomerAccountLinkModel.account_id, CustomerAccountLinkModel.customer_id)
            rows = (await session.execute(stmt)).all()
            self._account_to_customer = {r.account_id: r.customer_id for r in rows}

    def resolve(self, account_id: str) -> str:
        existing = self._account_to_customer.get(account_id)
        if existing:
            return existing

        now = datetime.now(UTC)
        customer_id = f"cust-{uuid.uuid4()}"
        self._account_to_customer[account_id] = customer_id
        self._pending_customers[customer_id] = now
        self._pending_accounts.add(account_id)
        self._pending_links.append((customer_id, account_id, now))
        return customer_id

    @property
    def has_pending(self) -> bool:
        return bool(self._pending_customers)

    async def flush_pending(self, session: AsyncSession) -> None:
        if not self._pending_customers:
            return

        await session.execute(
            pg_insert(CustomerModel)
            .values([{"customer_id": cid, "created_at": ts} for cid, ts in self._pending_customers.items()])
            .on_conflict_do_nothing(index_elements=["customer_id"])
        )
        await session.execute(
            pg_insert(AccountModel)
            .values([{"account_id": aid} for aid in self._pending_accounts])
            .on_conflict_do_nothing(index_elements=["account_id"])
        )
        await session.execute(
            pg_insert(CustomerAccountLinkModel)
            .values(
                [
                    {"id": str(uuid.uuid4()), "customer_id": cid, "account_id": aid, "role": "owner", "linked_at": ts}
                    for cid, aid, ts in self._pending_links
                ]
            )
            .on_conflict_do_nothing(index_elements=["account_id"])
        )

        self._pending_customers.clear()
        self._pending_accounts.clear()
        self._pending_links.clear()
