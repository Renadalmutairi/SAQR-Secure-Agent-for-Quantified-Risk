from app.domain.entities import Evidence, EvidenceType
from app.domain.ports import EvidenceContext, EvidenceProvider


class GeographicTrustEvidenceProvider(EvidenceProvider):
    """Reserved - no IP/geolocation data source exists anywhere in SAQR yet.
    Same contract as DeviceTrustEvidenceProvider: always unavailable until a
    real provider replaces it."""

    source = EvidenceType.GEOGRAPHIC_TRUST
    default_weight = 0.15

    def get_evidence(self, context: EvidenceContext) -> Evidence:
        return Evidence(source=self.source, available=False, detail="no geographic trust data source configured")
