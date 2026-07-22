import uuid
from datetime import UTC, datetime

from app.domain.entities import Account, Customer, CustomerAccountLink
from app.domain.ports import CustomerAccountRepository


class InMemoryCustomerAccountRepository(CustomerAccountRepository):
    """Bootstraps a customer per unseen account (1 account -> 1 synthetic customer).

    This is a placeholder entity-resolution strategy, not a design assumption: the
    schema and every port already support one customer owning many accounts. When
    real KYC data provides an account_id -> customer_id mapping, only this class's
    `get_or_create_customer_for_account` changes - callers never assume 1:1.
    """

    def __init__(self) -> None:
        self._customers: dict[str, Customer] = {}
        self._account_to_customer: dict[str, str] = {}
        self._customer_to_accounts: dict[str, set[str]] = {}

    async def get_or_create_customer_for_account(self, account_id: str) -> Customer:
        existing_id = self._account_to_customer.get(account_id)
        if existing_id:
            return self._customers[existing_id]

        customer_id = f"cust-{uuid.uuid4()}"
        customer = Customer(customer_id=customer_id, display_ref=account_id, created_at=datetime.now(UTC))
        self._customers[customer_id] = customer
        self._account_to_customer[account_id] = customer_id
        self._customer_to_accounts.setdefault(customer_id, set()).add(account_id)
        return customer

    async def accounts_for_customer(self, customer_id: str) -> list[Account]:
        account_ids = self._customer_to_accounts.get(customer_id, set())
        return [Account(account_id=aid) for aid in sorted(account_ids)]

    async def customer_for_account(self, account_id: str) -> Customer | None:
        customer_id = self._account_to_customer.get(account_id)
        return self._customers.get(customer_id) if customer_id else None

    async def link(self, link: CustomerAccountLink) -> None:
        if link.customer_id not in self._customers:
            self._customers[link.customer_id] = Customer(
                customer_id=link.customer_id, created_at=link.linked_at
            )
        self._account_to_customer[link.account_id] = link.customer_id
        self._customer_to_accounts.setdefault(link.customer_id, set()).add(link.account_id)
