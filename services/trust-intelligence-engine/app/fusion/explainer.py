from app.domain.entities import EvidenceContribution, EvidenceType

_NEUTRAL_SCORE = 0.5


def dominant_factors(contributions: list[EvidenceContribution]) -> tuple[list[str], list[str]]:
    """Ranks available evidence by contribution magnitude, split by whether the
    evidence's own score read as more or less trustworthy than neutral (0.5)."""
    usable = [c for c in contributions if c.available and c.score is not None]

    positive = sorted((c for c in usable if c.score > _NEUTRAL_SCORE), key=lambda c: c.contribution, reverse=True)
    negative = sorted((c for c in usable if c.score < _NEUTRAL_SCORE), key=lambda c: c.contribution)

    return [c.source.value for c in positive], [c.source.value for c in negative]


def build_explanation(
    trust_score: float,
    confidence_level: float,
    contributions: list[EvidenceContribution],
    missing_evidence: list[EvidenceType],
) -> str:
    """Machine-readable (parseable by a downstream Decision Agent) but also
    human-legible - every number in the output is traceable back to a sentence
    here."""
    parts = [f"Trust score {trust_score:.2f} at confidence level {confidence_level:.2f}."]

    available = [c for c in contributions if c.available]
    if available:
        detail = ", ".join(f"{c.source.value}={c.score:.2f} (weight {c.weight:.2f})" for c in available)
        parts.append(f"Evidence used: {detail}.")

    if missing_evidence:
        parts.append(f"Missing evidence (excluded from fusion, not treated as neutral): {', '.join(e.value for e in missing_evidence)}.")

    return " ".join(parts)
