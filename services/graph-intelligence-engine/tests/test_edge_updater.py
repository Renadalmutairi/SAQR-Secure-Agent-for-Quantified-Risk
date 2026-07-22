from datetime import UTC, datetime, timedelta

from app.domain.entities import BehavioralAnnotation, RawTransactionEvent
from app.graph.edge_updater import apply_behavioral_annotation_to_edge, next_edge_properties_for_transaction

BASE_TIME = datetime(2026, 1, 1, tzinfo=UTC)


def _event(i: int, amount: float = 100.0) -> RawTransactionEvent:
    return RawTransactionEvent(
        tx_id=str(i), sender_account_id="A", receiver_account_id="B",
        tx_type="TRANSFER", amount=amount, occurred_at=BASE_TIME + timedelta(hours=i),
    )


def test_first_transaction_initializes_stored_properties():
    props = next_edge_properties_for_transaction(None, _event(0, amount=50.0))
    assert props.interaction_count == 1
    assert props.total_amount == 50.0
    assert props.first_seen == BASE_TIME
    assert props.last_seen == BASE_TIME
    assert props.gap_seconds_stats.count == 0  # no gap yet - only one data point


def test_second_transaction_accumulates_and_measures_gap():
    props1 = next_edge_properties_for_transaction(None, _event(0, amount=50.0))
    props2 = next_edge_properties_for_transaction(props1, _event(1, amount=75.0))

    assert props2.interaction_count == 2
    assert props2.total_amount == 125.0
    assert props2.first_seen == BASE_TIME  # unchanged
    assert props2.last_seen == BASE_TIME + timedelta(hours=1)
    assert props2.gap_seconds_stats.count == 1
    assert props2.gap_seconds_stats.mean == 3600.0  # exactly 1 hour


def test_regular_intervals_produce_zero_gap_variance():
    props = next_edge_properties_for_transaction(None, _event(0))
    for i in range(1, 6):
        props = next_edge_properties_for_transaction(props, _event(i))
    # every gap is exactly 1 hour -> zero variance -> perfectly consistent
    assert props.gap_seconds_stats.m2 == 0.0


def test_behavioral_annotation_ewma_seeds_from_first_value():
    props = next_edge_properties_for_transaction(None, _event(0))
    annotation = BehavioralAnnotation(
        transaction_id="0", customer_id="cust-1", account_id="A", receiver_account_id="B",
        behavioral_risk_score=0.8, confidence_score=0.9, similarity_score=0.4,
        profile_version=1, occurred_at=BASE_TIME, generated_at=BASE_TIME,
    )
    updated = apply_behavioral_annotation_to_edge(props, annotation)
    assert updated.behavioral_risk_ewma == 0.8
    assert updated.behavioral_confidence_ewma == 0.9
    assert updated.behavioral_similarity_ewma == 0.4


def test_behavioral_annotation_ewma_blends_with_history():
    props = next_edge_properties_for_transaction(None, _event(0)).model_copy(
        update={"behavioral_risk_ewma": 0.2}
    )
    annotation = BehavioralAnnotation(
        transaction_id="1", customer_id="cust-1", account_id="A", receiver_account_id="B",
        behavioral_risk_score=1.0, confidence_score=1.0, similarity_score=1.0,
        profile_version=2, occurred_at=BASE_TIME, generated_at=BASE_TIME,
    )
    updated = apply_behavioral_annotation_to_edge(props, annotation, alpha=0.5)
    assert updated.behavioral_risk_ewma == 0.6  # 0.5*1.0 + 0.5*0.2
