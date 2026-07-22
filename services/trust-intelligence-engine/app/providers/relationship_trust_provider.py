from app.domain.entities import Evidence, EvidenceType
from app.domain.ports import EvidenceContext, EvidenceProvider


class RelationshipTrustEvidenceProvider(EvidenceProvider):
    """Sourced from Agent 2's average outgoing Structural Trust Score for this
    account - already trust-oriented (0-1, no inversion needed), with Agent 2's
    own graph_confidence_score used directly as this evidence's confidence."""

    source = EvidenceType.RELATIONSHIP_TRUST
    default_weight = 0.15

    def get_evidence(self, context: EvidenceContext) -> Evidence:
        output = context.graph_output
        if output is None or output.avg_outgoing_trust_score is None:
            return Evidence(source=self.source, available=False, detail="Agent 2 output unavailable")

        score = max(0.0, min(1.0, output.avg_outgoing_trust_score))
        return Evidence(
            source=self.source,
            available=True,
            score=score,
            confidence=output.graph_confidence_score,
            detail=f"avg_outgoing_trust_score ({output.avg_outgoing_trust_score:.3f})",
        )
