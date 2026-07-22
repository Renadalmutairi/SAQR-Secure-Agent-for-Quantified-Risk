from dataclasses import dataclass

from app.domain.entities import EvidenceContribution, EvidenceSource
from app.domain.ports import EvidenceContext
from app.fusion.config import FusionWeights


@dataclass
class FusionResult:
    overall_risk_score: float
    decision_confidence: float
    contributions: list[EvidenceContribution]


class RiskFusionEngine:
    """Weighs every source before deciding - never lets one agent dominate.
    Same shape as Agent 3's EvidenceFusionEngine: contribution = risk_value *
    confidence * weight; overall_risk_score = sum(contribution) /
    sum(weight of available evidence); decision_confidence = sum(weight of
    available evidence) / sum(weight of all evidence). An agent that is
    unavailable is excluded from the denominator entirely - never treated as
    neutral (0.5) or zero risk, which would silently understate or overstate
    the result.
    """

    def __init__(self, weights: FusionWeights | None = None) -> None:
        self._weights = weights or FusionWeights()

    def fuse(self, context: EvidenceContext) -> FusionResult:
        contributions = [
            self._behavioral_contribution(context),
            self._graph_contribution(context),
            self._trust_contribution(context),
            self._compliance_contribution(context),
        ]

        usable = [c for c in contributions if c.available]
        weight_available = sum(c.weight for c in usable)
        weight_total = self._weights.total()

        overall_risk_score = (
            sum(c.contribution for c in usable) / weight_available if weight_available > 0 else 0.0
        )
        decision_confidence = weight_available / weight_total if weight_total > 0 else 0.0

        return FusionResult(
            overall_risk_score=overall_risk_score,
            decision_confidence=decision_confidence,
            contributions=contributions,
        )

    def _behavioral_contribution(self, context: EvidenceContext) -> EvidenceContribution:
        b = context.behavioral
        weight = self._weights.behavioral
        if b is None or b.behavioral_risk_score is None:
            return EvidenceContribution(
                source=EvidenceSource.BEHAVIORAL, available=False, risk_value=None, confidence=None,
                weight=weight, contribution=0.0,
            )
        return EvidenceContribution(
            source=EvidenceSource.BEHAVIORAL, available=True, risk_value=b.behavioral_risk_score,
            confidence=b.confidence_score, weight=weight,
            contribution=b.behavioral_risk_score * b.confidence_score * weight,
        )

    def _graph_contribution(self, context: EvidenceContext) -> EvidenceContribution:
        g = context.graph
        weight = self._weights.graph
        if g is None or g.graph_confidence_score <= 0:
            return EvidenceContribution(
                source=EvidenceSource.GRAPH, available=False, risk_value=None, confidence=None,
                weight=weight, contribution=0.0,
            )
        return EvidenceContribution(
            source=EvidenceSource.GRAPH, available=True, risk_value=g.structural_complexity_score,
            confidence=g.graph_confidence_score, weight=weight,
            contribution=g.structural_complexity_score * g.graph_confidence_score * weight,
        )

    def _trust_contribution(self, context: EvidenceContext) -> EvidenceContribution:
        t = context.trust
        weight = self._weights.trust
        if t is None or t.confidence_level <= 0:
            return EvidenceContribution(
                source=EvidenceSource.TRUST, available=False, risk_value=None, confidence=None,
                weight=weight, contribution=0.0,
            )
        risk_value = 1.0 - t.trust_score  # trust is trust-oriented (higher=better); invert to risk orientation
        return EvidenceContribution(
            source=EvidenceSource.TRUST, available=True, risk_value=risk_value,
            confidence=t.confidence_level, weight=weight,
            contribution=risk_value * t.confidence_level * weight,
        )

    def _compliance_contribution(self, context: EvidenceContext) -> EvidenceContribution:
        c = context.compliance
        weight = self._weights.compliance
        if c is None or c.compliance_confidence <= 0:
            return EvidenceContribution(
                source=EvidenceSource.COMPLIANCE, available=False, risk_value=None, confidence=None,
                weight=weight, contribution=0.0,
            )
        risk_value = 1.0 - c.compliance_score  # compliance_score is compliance-oriented; invert to risk orientation
        return EvidenceContribution(
            source=EvidenceSource.COMPLIANCE, available=True, risk_value=risk_value,
            confidence=c.compliance_confidence, weight=weight,
            contribution=risk_value * c.compliance_confidence * weight,
        )
