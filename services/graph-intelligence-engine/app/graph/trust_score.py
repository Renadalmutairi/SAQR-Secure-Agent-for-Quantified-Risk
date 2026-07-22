"""Structural Trust Score: how well-established a relationship is in the graph.

NOT a fraud score - it represents accumulated legitimate interaction history.
Increases through repeated, regular, behaviorally-normal interactions; decays
with time since the relationship was last active. Always computed at read time
from EdgeStoredProperties - never persisted, same principle as time_decay_weight.
"""

from dataclasses import dataclass
from datetime import datetime

from app.domain.entities import EdgeDerivedMetrics, EdgeStoredProperties
from app.graph.stats import (
    coefficient_of_variation,
    consistency_from_cv,
    exponential_decay,
    saturating_growth,
)


@dataclass
class TrustScoreWeights:
    frequency: float = 0.25
    age: float = 0.2
    temporal_consistency: float = 0.2
    behavioral_similarity: float = 0.2
    transaction_regularity: float = 0.15

    def __post_init__(self) -> None:
        total = self.frequency + self.age + self.temporal_consistency + self.behavioral_similarity + self.transaction_regularity
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"TrustScoreWeights must sum to 1.0, got {total}")


@dataclass
class TrustScoreConfig:
    weights: TrustScoreWeights
    frequency_scale: float = 20.0  # interactions to reach ~63% of max frequency component
    age_scale_seconds: float = 30 * 24 * 3600  # 30 days to reach ~63% of max age component
    decay_half_life_seconds: float = 14 * 24 * 3600  # 14 days of inactivity halves trust


DEFAULT_TRUST_CONFIG = TrustScoreConfig(weights=TrustScoreWeights())


def compute_edge_derived_metrics(
    props: EdgeStoredProperties, now: datetime, config: TrustScoreConfig = DEFAULT_TRUST_CONFIG
) -> EdgeDerivedMetrics:
    if props.first_seen is None or props.last_seen is None or props.interaction_count == 0:
        # No history yet - every derived metric is neutral/zero, not a guess.
        return EdgeDerivedMetrics(
            average_amount=0.0,
            relationship_age_seconds=0.0,
            time_decay_weight=0.0,
            temporal_consistency=0.5,
            transaction_regularity=0.5,
            structural_trust_score=0.0,
        )

    average_amount = props.total_amount / props.interaction_count
    relationship_age_seconds = max((now - props.first_seen).total_seconds(), 0.0)
    seconds_since_last_seen = max((now - props.last_seen).total_seconds(), 0.0)
    time_decay_weight = exponential_decay(seconds_since_last_seen, config.decay_half_life_seconds)

    temporal_consistency = consistency_from_cv(coefficient_of_variation(props.gap_seconds_stats))
    transaction_regularity = consistency_from_cv(coefficient_of_variation(props.amount_log_stats))

    frequency_component = saturating_growth(float(props.interaction_count), config.frequency_scale)
    age_component = saturating_growth(relationship_age_seconds, config.age_scale_seconds)
    similarity_component = props.behavioral_similarity_ewma if props.behavioral_similarity_ewma is not None else 0.5

    w = config.weights
    raw_trust = (
        w.frequency * frequency_component
        + w.age * age_component
        + w.temporal_consistency * temporal_consistency
        + w.behavioral_similarity * similarity_component
        + w.transaction_regularity * transaction_regularity
    )
    structural_trust_score = raw_trust * time_decay_weight

    return EdgeDerivedMetrics(
        average_amount=average_amount,
        relationship_age_seconds=relationship_age_seconds,
        time_decay_weight=time_decay_weight,
        temporal_consistency=temporal_consistency,
        transaction_regularity=transaction_regularity,
        structural_trust_score=structural_trust_score,
    )
