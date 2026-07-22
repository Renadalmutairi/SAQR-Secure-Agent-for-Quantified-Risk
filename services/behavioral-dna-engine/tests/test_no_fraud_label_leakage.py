from app.domain.entities import DnaOutput, TransactionEvent

_FORBIDDEN_FIELDS = {"is_fraud", "alert_id"}


def test_transaction_event_cannot_carry_fraud_labels():
    """Agent 1 must never see fraud/AML labels - it only reports behavioral
    deviation, never a fraud verdict. Enforced structurally, not just by convention.
    """
    assert _FORBIDDEN_FIELDS.isdisjoint(TransactionEvent.model_fields.keys())


def test_dna_output_never_carries_a_fraud_verdict():
    assert _FORBIDDEN_FIELDS.isdisjoint(DnaOutput.model_fields.keys())
    assert "is_fraud" not in DnaOutput.model_fields
    assert "decision" not in DnaOutput.model_fields
    assert "blocked" not in DnaOutput.model_fields
