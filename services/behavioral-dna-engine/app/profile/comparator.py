from dataclasses import dataclass, field

from app.domain.entities import ChangedFeature, DnaVectorEntry, FeatureValue
from app.profile.stats import deviation_level, z_score


@dataclass
class DeviationResult:
    changed_features: list[ChangedFeature] = field(default_factory=list)
    behavioral_risk_score: float = 0.0
    similarity_score: float = 1.0


def compare(observed_features: list[FeatureValue], baseline: dict[str, DnaVectorEntry]) -> DeviationResult:
    """Compare a new transaction's features against the customer's PRIOR baseline.

    Must be called before the baseline is updated with this transaction, or every
    transaction would trivially look "normal" relative to itself.
    """
    changed: list[ChangedFeature] = []
    abs_z_scores: list[float] = []

    for fv in observed_features:
        entry = baseline.get(fv.name)
        if entry is None or entry.count < 2:
            # Not enough history for this feature yet - cold start, not comparable.
            continue
        z = z_score(fv.value, entry.mean, entry.stddev)
        abs_z = abs(z)
        abs_z_scores.append(abs_z)
        level = deviation_level(abs_z)
        if level != "normal":
            changed.append(
                ChangedFeature(
                    feature=fv.name,
                    group=fv.group,
                    baseline_mean=entry.mean,
                    baseline_stddev=entry.stddev,
                    observed=fv.value,
                    z_score=z,
                    deviation_level=level,
                )
            )

    if not abs_z_scores:
        # No comparable baseline yet - neutral, not a false "definitely normal".
        return DeviationResult(changed_features=[], behavioral_risk_score=0.0, similarity_score=1.0)

    # Cap each feature's contribution so one wild feature can't saturate the score alone.
    capped = [min(z, 5.0) for z in abs_z_scores]
    avg_abs_z = sum(capped) / len(capped)
    risk_score = min(avg_abs_z / 5.0, 1.0)
    similarity_score = 1.0 / (1.0 + avg_abs_z)
    return DeviationResult(changed_features=changed, behavioral_risk_score=risk_score, similarity_score=similarity_score)
