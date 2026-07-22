from app.domain.entities import Evidence, EvidenceType
from app.domain.ports import EvidenceContext, EvidenceProvider


class DeviceTrustEvidenceProvider(EvidenceProvider):
    """Reserved - no device/session data source exists anywhere in SAQR yet
    (same gap flagged and deferred in Agent 1's and Agent 2's specs). Always
    reports unavailable so it's correctly excluded from fusion and listed in
    missing_evidence, rather than fabricating a neutral score. Replacing this
    with a real provider later requires no change to the fusion engine or the
    other providers.
    """

    source = EvidenceType.DEVICE_TRUST
    default_weight = 0.20

    def get_evidence(self, context: EvidenceContext) -> Evidence:
        return Evidence(source=self.source, available=False, detail="no device trust data source configured")
