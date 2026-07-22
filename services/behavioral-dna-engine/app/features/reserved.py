"""Feature groups reserved for data SAQR does not yet ingest.

Each class documents the exact input signal it needs. They register with the
default registry but with `enabled = False`, so the registry and the profile
schema already know these groups exist - turning one on later is a config flip
plus a real `extract()` implementation, not a schema migration or a rewrite of
the profile builder/updater/comparator.
"""

from app.domain.entities import FeatureValue, TransactionEvent
from app.features.base import FeatureContext, FeatureGroup


class TemporalFeatures(FeatureGroup):
    """Day-of-week / time-of-day / session-gap features.

    Requires real calendar timestamps. The current dataset only has a synthetic
    step index (0-199), so "daily habits" / "weekly habits" cannot be computed yet.
    """

    name = "temporal"
    enabled = False

    def extract(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]:
        raise NotImplementedError("Requires real calendar timestamps, not present in the current data source")


class DeviceFeatures(FeatureGroup):
    """Device fingerprint / trusted-device features.

    Requires a login/session log joined by account_id and time - not present
    in transactions.csv.
    """

    name = "device"
    enabled = False

    def extract(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]:
        raise NotImplementedError("Requires a device/session data source, not present in the current data source")


class GeoFeatures(FeatureGroup):
    """Geographic movement / IP-based location features. Requires IP or GPS data."""

    name = "geo"
    enabled = False

    def extract(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]:
        raise NotImplementedError("Requires an IP/geolocation data source, not present in the current data source")


class SessionFeatures(FeatureGroup):
    """Session duration / login-behavior features. Requires session/login logs."""

    name = "session"
    enabled = False

    def extract(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]:
        raise NotImplementedError("Requires a session log data source, not present in the current data source")
