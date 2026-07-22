from datetime import UTC, datetime

from app.domain.entities import TransactionEvent
from app.features.amount_features import AmountFeatures
from app.features.base import FeatureContext
from app.features.beneficiary_features import BeneficiaryFeatures
from app.features.reserved import DeviceFeatures, GeoFeatures, SessionFeatures, TemporalFeatures
from app.features.structural_features import StructuralFeatures


def _event(sender="A", receiver="B", amount=100.0) -> TransactionEvent:
    return TransactionEvent(
        tx_id="1", sender_account_id=sender, receiver_account_id=receiver,
        tx_type="TRANSFER", amount=amount, occurred_at=datetime.now(UTC), raw_timestamp_step=0,
    )


def test_self_loop_is_flagged():
    ctx = FeatureContext(account_id="A", trusted_beneficiaries={})
    features = StructuralFeatures().extract(_event(sender="A", receiver="A"), ctx)
    assert features[0].value == 1.0


def test_non_self_loop_is_not_flagged():
    ctx = FeatureContext(account_id="A", trusted_beneficiaries={})
    features = StructuralFeatures().extract(_event(sender="A", receiver="B"), ctx)
    assert features[0].value == 0.0


def test_new_beneficiary_is_flagged():
    ctx = FeatureContext(account_id="A", trusted_beneficiaries={})
    features = BeneficiaryFeatures().extract(_event(receiver="new-account"), ctx)
    is_new = next(f for f in features if f.name == "beneficiary_is_new")
    assert is_new.value == 1.0


def test_known_beneficiary_is_not_flagged_as_new():
    ctx = FeatureContext(account_id="A", trusted_beneficiaries={"known-account": 12})
    features = BeneficiaryFeatures().extract(_event(receiver="known-account"), ctx)
    is_new = next(f for f in features if f.name == "beneficiary_is_new")
    familiarity = next(f for f in features if f.name == "beneficiary_familiarity")
    assert is_new.value == 0.0
    assert familiarity.value > 0.0


def test_amount_feature_is_log_transformed():
    ctx = FeatureContext(account_id="A", trusted_beneficiaries={})
    features = AmountFeatures().extract(_event(amount=1000.0), ctx)
    assert features[0].name == "log_amount"
    assert features[0].value < 1000.0  # sanity: it's compressed, not raw


def test_reserved_feature_groups_are_disabled_by_default():
    for group_cls in (TemporalFeatures, DeviceFeatures, GeoFeatures, SessionFeatures):
        assert group_cls().enabled is False
