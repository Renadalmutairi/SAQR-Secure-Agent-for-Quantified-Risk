from app.domain.entities import Evidence, EvidenceType
from app.domain.ports import EvidenceContext, EvidenceProvider


class BehavioralDnaEvidenceProvider(EvidenceProvider):
    """Trust is the inverse of Agent 1's behavioral risk: a customer behaving
    normally relative to their own baseline is trustworthy evidence; a customer
    deviating sharply is not. Agent 1's own confidence_score (how much history
    backs that baseline) becomes this evidence's confidence directly."""

    source = EvidenceType.BEHAVIORAL_DNA
    default_weight = 0.40

    def get_evidence(self, context: EvidenceContext) -> Evidence:
        profile = context.profile
        if profile is None or profile.behavioral_risk_score is None:
            return Evidence(source=self.source, available=False, detail="Agent 1 profile unavailable")

        trust = max(0.0, min(1.0, 1.0 - profile.behavioral_risk_score))
        return Evidence(
            source=self.source,
            available=True,
            score=trust,
            confidence=profile.confidence_score,
            detail=f"1 - behavioral_risk_score ({profile.behavioral_risk_score:.3f})",
        )
