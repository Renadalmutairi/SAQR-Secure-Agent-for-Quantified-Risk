from datetime import UTC, datetime

from app.domain.entities import (
    DecisionOutput,
    DecisionRequest,
    EvidenceContribution,
    EvidenceSource,
)
from app.domain.ports import EvidenceContext
from app.fusion.engine import FusionResult

_NEUTRAL_RISK = 0.5

_AGENT_NAMES = {
    EvidenceSource.BEHAVIORAL: "behavioral_dna",
    EvidenceSource.GRAPH: "graph_intelligence",
    EvidenceSource.TRUST: "trust_intelligence",
    EvidenceSource.COMPLIANCE: "compliance",
}


def _describe(contribution: EvidenceContribution, context: EvidenceContext) -> str:
    source = contribution.source
    if source == EvidenceSource.BEHAVIORAL and context.behavioral is not None:
        return (
            f"Behavioral DNA: risk {contribution.risk_value:.2f} at confidence {contribution.confidence:.2f} "
            f"(based on {context.behavioral.history_depth} historical transactions)"
        )
    if source == EvidenceSource.GRAPH and context.graph is not None:
        community = (
            f", community {context.graph.community_id} (size {context.graph.community_size})"
            if context.graph.community_id
            else ""
        )
        return (
            f"Graph Intelligence: structural complexity {contribution.risk_value:.2f} at confidence "
            f"{contribution.confidence:.2f}{community}"
        )
    if source == EvidenceSource.TRUST and context.trust is not None:
        return (
            f"Trust Intelligence: trust score {context.trust.trust_score:.2f} at confidence "
            f"{contribution.confidence:.2f}"
        )
    if source == EvidenceSource.COMPLIANCE and context.compliance is not None:
        return (
            f"Compliance: status {context.compliance.compliance_status} at confidence "
            f"{contribution.confidence:.2f}"
        )
    return f"{_AGENT_NAMES[source]}: unavailable"


def _positive_negative_factors(
    contributions: list[EvidenceContribution], context: EvidenceContext
) -> tuple[list[str], list[str]]:
    usable = [c for c in contributions if c.available and c.risk_value is not None]

    positive = sorted((c for c in usable if c.risk_value < _NEUTRAL_RISK), key=lambda c: c.contribution)
    negative = sorted((c for c in usable if c.risk_value >= _NEUTRAL_RISK), key=lambda c: c.contribution, reverse=True)

    positive_factors = [_describe(c, context) for c in positive]
    negative_factors = [_describe(c, context) for c in negative]

    if context.graph is not None and context.graph.anomaly_descriptions:
        negative_factors.extend(f"Graph anomaly: {d}" for d in context.graph.anomaly_descriptions)

    if context.compliance is not None and context.compliance.violated_rules:
        negative_factors.extend(f"Compliance rule violated: {r}" for r in context.compliance.violated_rules)

    if context.trust is not None:
        positive_factors.extend(f"Trust factor: {f}" for f in context.trust.dominant_positive_factors)
        negative_factors.extend(f"Trust factor: {f}" for f in context.trust.dominant_negative_factors)

    return positive_factors, negative_factors


def build_decision_output(
    request: DecisionRequest,
    context: EvidenceContext,
    fusion: FusionResult,
    decision,
    risk_level,
    override_reason: str | None,
) -> DecisionOutput:
    contributing_agents = [_AGENT_NAMES[c.source] for c in fusion.contributions if c.available]
    positive_factors, negative_factors = _positive_negative_factors(fusion.contributions, context)

    reasoning_parts = [
        f"Overall risk score {fusion.overall_risk_score:.2f} ({risk_level.value}) at decision confidence "
        f"{fusion.decision_confidence:.2f}, based on {len(contributing_agents)}/4 available agents.",
    ]
    available_detail = [_describe(c, context) for c in fusion.contributions if c.available]
    if available_detail:
        reasoning_parts.append("Evidence: " + "; ".join(available_detail) + ".")
    unavailable = [_AGENT_NAMES[c.source] for c in fusion.contributions if not c.available]
    if unavailable:
        reasoning_parts.append(
            f"Unavailable (excluded from fusion, not treated as neutral): {', '.join(unavailable)}."
        )
    if override_reason:
        reasoning_parts.append(f"Override: {override_reason}.")
    reasoning_parts.append(f"Final decision: {decision.value}.")

    return DecisionOutput(
        transaction_id=request.transaction_id,
        customer_id=request.customer_id,
        decision=decision,
        risk_level=risk_level,
        overall_risk_score=fusion.overall_risk_score,
        decision_confidence=fusion.decision_confidence,
        reasoning=" ".join(reasoning_parts),
        contributing_agents=contributing_agents,
        positive_factors=positive_factors,
        negative_factors=negative_factors,
        evidence_breakdown=fusion.contributions,
        generated_at=datetime.now(UTC),
    )
