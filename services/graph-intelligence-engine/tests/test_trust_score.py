from datetime import UTC, datetime, timedelta

import pytest

from app.domain.entities import RawTransactionEvent
from app.graph.edge_updater import next_edge_properties_for_transaction
from app.graph.trust_score import DEFAULT_TRUST_CONFIG, TrustScoreWeights, compute_edge_derived_metrics

BASE_TIME = datetime(2026, 1, 1, tzinfo=UTC)


def _event(i: int, amount: float = 100.0) -> RawTransactionEvent:
    return RawTransactionEvent(
        tx_id=str(i), sender_account_id="A", receiver_account_id="B",
        tx_type="TRANSFER", amount=amount, occurred_at=BASE_TIME + timedelta(hours=i),
    )


def test_weights_must_sum_to_one():
    with pytest.raises(ValueError):
        TrustScoreWeights(frequency=0.5, age=0.5, temporal_consistency=0.5, behavioral_similarity=0.0, transaction_regularity=0.0)


def test_no_history_yields_zero_trust():
    from app.domain.entities import EdgeStoredProperties

    metrics = compute_edge_derived_metrics(EdgeStoredProperties(), now=BASE_TIME)
    assert metrics.structural_trust_score == 0.0
    assert metrics.average_amount == 0.0


def test_trust_score_increases_with_repeated_regular_interactions():
    props = next_edge_properties_for_transaction(None, _event(0))
    early_metrics = compute_edge_derived_metrics(props, now=_event(0).occurred_at)

    for i in range(1, 20):
        props = next_edge_properties_for_transaction(props, _event(i))
    later_metrics = compute_edge_derived_metrics(props, now=_event(19).occurred_at)

    assert later_metrics.structural_trust_score > early_metrics.structural_trust_score


def test_trust_score_decays_after_long_inactivity():
    props = next_edge_properties_for_transaction(None, _event(0))
    for i in range(1, 20):
        props = next_edge_properties_for_transaction(props, _event(i))

    fresh = compute_edge_derived_metrics(props, now=_event(19).occurred_at)
    stale = compute_edge_derived_metrics(props, now=_event(19).occurred_at + timedelta(days=365))

    assert stale.structural_trust_score < fresh.structural_trust_score
    assert stale.time_decay_weight < fresh.time_decay_weight


def test_irregular_amounts_reduce_transaction_regularity_component():
    regular_props = next_edge_properties_for_transaction(None, _event(0, amount=100.0))
    for i in range(1, 10):
        regular_props = next_edge_properties_for_transaction(regular_props, _event(i, amount=100.0))

    irregular_props = next_edge_properties_for_transaction(None, _event(0, amount=1.0))
    amounts = [5000.0, 1.0, 900000.0, 3.0, 250000.0, 2.0, 700000.0, 1.5, 400000.0]
    for i, amt in enumerate(amounts, start=1):
        irregular_props = next_edge_properties_for_transaction(irregular_props, _event(i, amount=amt))

    regular_metrics = compute_edge_derived_metrics(regular_props, now=_event(9).occurred_at)
    irregular_metrics = compute_edge_derived_metrics(irregular_props, now=_event(9).occurred_at)

    assert regular_metrics.transaction_regularity > irregular_metrics.transaction_regularity


def test_structural_trust_score_is_bounded_zero_to_one():
    props = next_edge_properties_for_transaction(None, _event(0))
    for i in range(1, 200):
        props = next_edge_properties_for_transaction(props, _event(i))
    metrics = compute_edge_derived_metrics(props, now=_event(199).occurred_at)
    assert 0.0 <= metrics.structural_trust_score <= 1.0
