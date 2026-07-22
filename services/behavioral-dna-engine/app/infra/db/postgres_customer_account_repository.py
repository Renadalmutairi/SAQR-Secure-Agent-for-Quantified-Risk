import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.domain.entities import Account, Customer, CustomerAccountLink
from app.domain.ports import CustomerAccountRepository
from app.infra.db.models import AccountModel, CustomerAccountLinkModel, CustomerModel


class PostgresCustomerAccountRepository(CustomerAccountRepository):
    """Real customer<->account graph. `account_id` has a UNIQUE constraint on the
    link table (one current owner per account today), but `customer_id` is not
    unique - a customer can own many accounts. Swapping the resolution strategy in
    `get_or_create_customer_for_account` for real KYC-linked entity resolution
    later does not require a schema change, only a different lookup here.
    """

    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._session_factory = session_factory

    async def get_or_create_customer_for_account(self, account_id: str) -> Customer:
        async with self._session_factory() as session:
            async with session.begin():
                stmt = select(CustomerAccountLinkModel).where(CustomerAccountLinkModel.account_id == account_id)
                link = (await session.execute(stmt)).scalar_one_or_none()
                if link:
                    customer_row = await session.get(CustomerModel, link.customer_id)
                    return Customer(
                        customer_id=customer_row.customer_id,
                        display_ref=customer_row.display_ref,
                        created_at=customer_row.created_at,
                    )

                now = datetime.now(UTC)
                customer_id = f"cust-{uuid.uuid4()}"
                session.add(CustomerModel(customer_id=customer_id, display_ref=account_id, created_at=now))
                await session.execute(
                    pg_insert(AccountModel)
                    .values(account_id=account_id, product_type="TRANSACTION_ACCOUNT", opened_at=None)
                    .on_conflict_do_nothing(index_elements=["account_id"])
                )
                session.add(
                    CustomerAccountLinkModel(
                        id=str(uuid.uuid4()), customer_id=customer_id, account_id=account_id,
                        role="owner", linked_at=now,
                    )
                )
                return Customer(customer_id=customer_id, display_ref=account_id, created_at=now)

    async def accounts_for_customer(self, customer_id: str) -> list[Account]:
        async with self._session_factory() as session:
            stmt = select(AccountModel).join(
                CustomerAccountLinkModel, CustomerAccountLinkModel.account_id == AccountModel.account_id
            ).where(CustomerAccountLinkModel.customer_id == customer_id)
            rows = (await session.execute(stmt)).scalars().all()
            return [Account(account_id=r.account_id, product_type=r.product_type, opened_at=r.opened_at) for r in rows]

    async def customer_for_account(self, account_id: str) -> Customer | None:
        async with self._session_factory() as session:
            stmt = select(CustomerModel).join(
                CustomerAccountLinkModel, CustomerAccountLinkModel.customer_id == CustomerModel.customer_id
            ).where(CustomerAccountLinkModel.account_id == account_id)
            row = (await session.execute(stmt)).scalar_one_or_none()
            if not row:
                return None
            return Customer(customer_id=row.customer_id, display_ref=row.display_ref, created_at=row.created_at)

    async def link(self, link: CustomerAccountLink) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                await session.execute(
                    pg_insert(CustomerModel)
                    .values(customer_id=link.customer_id, created_at=link.linked_at)
                    .on_conflict_do_nothing(index_elements=["customer_id"])
                )
                await session.execute(
                    pg_insert(AccountModel)
                    .values(account_id=link.account_id)
                    .on_conflict_do_nothing(index_elements=["account_id"])
                )
                await session.execute(
                    pg_insert(CustomerAccountLinkModel)
                    .values(
                        id=str(uuid.uuid4()), customer_id=link.customer_id, account_id=link.account_id,
                        role=link.role.value, linked_at=link.linked_at,
                    )
                    .on_conflict_do_update(
                        index_elements=["account_id"],
                        set_={"customer_id": link.customer_id, "role": link.role.value},
                    )
                )
