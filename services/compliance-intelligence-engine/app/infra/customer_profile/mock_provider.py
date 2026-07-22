from app.domain.entities import CustomerProfileSnapshot
from app.domain.ports import CustomerProfileProvider


class MockCustomerProfileProvider(CustomerProfileProvider):
    """Always returns None - SAQR has no KYC/customer-master system yet.
    Reserved extension point: a real implementation plugs in behind this
    same interface without touching the rule engine, explainer, or API
    layer, exactly like Agent 3's disabled DeviceTrust/GeographicTrust
    providers and Agent 1's disabled TemporalFeatures/DeviceFeatures."""

    async def get_profile(self, customer_id: str) -> CustomerProfileSnapshot | None:
        return None
