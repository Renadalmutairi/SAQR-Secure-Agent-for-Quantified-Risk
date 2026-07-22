"""Constraints applied once at startup. Uniqueness constraints double as indexes,
which is what keeps every MERGE in the hot path a fast lookup, not a scan.
"""

from neo4j import AsyncDriver

CONSTRAINTS = [
    "CREATE CONSTRAINT customer_id_unique IF NOT EXISTS FOR (c:Customer) REQUIRE c.customer_id IS UNIQUE",
    "CREATE CONSTRAINT account_id_unique IF NOT EXISTS FOR (a:Account) REQUIRE a.account_id IS UNIQUE",
    "CREATE CONSTRAINT tx_id_unique IF NOT EXISTS FOR (t:Transaction) REQUIRE t.tx_id IS UNIQUE",
]


async def apply_schema(driver: AsyncDriver) -> None:
    async with driver.session() as session:
        for stmt in CONSTRAINTS:
            await session.run(stmt)
