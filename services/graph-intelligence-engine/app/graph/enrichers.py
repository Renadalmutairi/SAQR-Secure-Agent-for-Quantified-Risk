"""Reserved node/edge enrichers - Device, IP, Merchant, Company, Session, Country.

None of these have a data source yet (same situation Agent 1 was in with
device/session data). Each documents exactly what it needs. Registered now,
disabled, so enabling one later is a config flip plus a real data source, not a
schema redesign or a rewrite of the hot/cold path - mirrors Agent 1's
FeatureRegistry pattern exactly.
"""

from app.domain.entities import RawTransactionEvent
from app.domain.ports import NodeEnricher


class DeviceEnricher(NodeEnricher):
    """Would create (Transaction)-[:EXECUTED_FROM]->(Device) edges. Needs a
    device-fingerprint/session log joined by tx_id - not present in the raw
    transaction feed."""

    name = "device"
    enabled = False

    async def enrich(self, event: RawTransactionEvent) -> None:
        raise NotImplementedError("Requires a device/session data source, not present in the current data source")


class IpAddressEnricher(NodeEnricher):
    """Would create (Transaction)-[:ORIGINATED_FROM]->(IPAddress) edges. Needs IP
    data joined by tx_id."""

    name = "ip_address"
    enabled = False

    async def enrich(self, event: RawTransactionEvent) -> None:
        raise NotImplementedError("Requires an IP data source, not present in the current data source")


class MerchantEnricher(NodeEnricher):
    """Would create (Transaction)-[:PAID_TO]->(Merchant) edges. Needs merchant
    identity on payment-type transactions - the current data is 100% TRANSFER,
    no merchant/payment transaction type exists yet."""

    name = "merchant"
    enabled = False

    async def enrich(self, event: RawTransactionEvent) -> None:
        raise NotImplementedError("Requires merchant-tagged transactions, not present in the current data source")


class CompanyEnricher(NodeEnricher):
    """Would create (Merchant)-[:BELONGS_TO]->(Company) edges. Depends on
    MerchantEnricher's data existing first."""

    name = "company"
    enabled = False

    async def enrich(self, event: RawTransactionEvent) -> None:
        raise NotImplementedError("Requires merchant/company registry data, not present in the current data source")


class SessionEnricher(NodeEnricher):
    """Would create (Customer)-[:USES]->(Session) context. Needs login/session
    logs - same gap Agent 1 already flagged for its own device/session features."""

    name = "session"
    enabled = False

    async def enrich(self, event: RawTransactionEvent) -> None:
        raise NotImplementedError("Requires session log data, not present in the current data source")


class CountryEnricher(NodeEnricher):
    """Would create Customer/IP -[:LOCATED_IN]-> Country edges. Needs IP
    geolocation or KYC address data - neither exists yet."""

    name = "country"
    enabled = False

    async def enrich(self, event: RawTransactionEvent) -> None:
        raise NotImplementedError("Requires geolocation/KYC data, not present in the current data source")


def build_reserved_enrichers() -> list[NodeEnricher]:
    return [
        DeviceEnricher(),
        IpAddressEnricher(),
        MerchantEnricher(),
        CompanyEnricher(),
        SessionEnricher(),
        CountryEnricher(),
    ]
