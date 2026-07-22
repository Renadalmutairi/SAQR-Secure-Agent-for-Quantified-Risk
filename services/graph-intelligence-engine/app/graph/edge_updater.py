"""Pure builders for the next EdgeStoredProperties state - no I/O, no Neo4j.
Mirrors Agent 1's app/profile/updater.py: the graph store adapter is responsible
for reading the previous state, calling these, and writing the result back.
"""

import math

from app.domain.entities import BehavioralAnnotation, EdgeStoredProperties, RawTransactionEvent, WelfordState
from app.graph.stats import ewma_update, welford_update

DEFAULT_EWMA_ALPHA = 0.3


def next_edge_properties_for_transaction(
    previous: EdgeStoredProperties | None, event: RawTransactionEvent
) -> EdgeStoredProperties:
    if previous is None:
        # First transaction on this edge - no gap to measure yet, so
        # gap_seconds_stats stays empty until a second transaction arrives.
        return EdgeStoredProperties(
            interaction_count=1,
            total_amount=event.amount,
            first_seen=event.occurred_at,
            last_seen=event.occurred_at,
            gap_seconds_stats=WelfordState(),
            amount_log_stats=welford_update(WelfordState(), math.log1p(max(event.amount, 0.0))),
        )

    gap_seconds = max((event.occurred_at - previous.last_seen).total_seconds(), 0.0) if previous.last_seen else 0.0
    return previous.model_copy(
        update={
            "interaction_count": previous.interaction_count + 1,
            "total_amount": previous.total_amount + event.amount,
            "last_seen": event.occurred_at,
            "gap_seconds_stats": welford_update(previous.gap_seconds_stats, gap_seconds),
            "amount_log_stats": welford_update(previous.amount_log_stats, math.log1p(max(event.amount, 0.0))),
        }
    )


def apply_behavioral_annotation_to_edge(
    previous: EdgeStoredProperties, annotation: BehavioralAnnotation, alpha: float = DEFAULT_EWMA_ALPHA
) -> EdgeStoredProperties:
    return previous.model_copy(
        update={
            "behavioral_similarity_ewma": ewma_update(
                previous.behavioral_similarity_ewma, annotation.similarity_score, alpha
            ),
            "behavioral_confidence_ewma": ewma_update(
                previous.behavioral_confidence_ewma, annotation.confidence_score, alpha
            ),
            "behavioral_risk_ewma": ewma_update(previous.behavioral_risk_ewma, annotation.behavioral_risk_score, alpha),
        }
    )
