from app.domain.entities import DnaVectorEntry, FeatureValue
from app.profile.comparator import compare


def _baseline_entry(feature: str, count: int, mean: float, stddev: float) -> DnaVectorEntry:
    # m2 = variance * count, variance = stddev^2 (population)
    return DnaVectorEntry(feature=feature, group="amount", count=count, mean=mean, m2=(stddev**2) * count)


def test_cold_start_feature_is_not_flagged_as_deviation():
    observed = [FeatureValue(name="log_amount", value=5.0, group="amount")]
    result = compare(observed, baseline={})
    assert result.changed_features == []
    assert result.behavioral_risk_score == 0.0
    assert result.similarity_score == 1.0


def test_normal_transaction_close_to_baseline_is_not_flagged():
    baseline = {"log_amount": _baseline_entry("log_amount", count=50, mean=5.0, stddev=1.0)}
    observed = [FeatureValue(name="log_amount", value=5.1, group="amount")]
    result = compare(observed, baseline)
    assert result.changed_features == []
    assert result.behavioral_risk_score < 0.2


def test_extreme_deviation_is_flagged_high():
    baseline = {"log_amount": _baseline_entry("log_amount", count=50, mean=5.0, stddev=1.0)}
    observed = [FeatureValue(name="log_amount", value=20.0, group="amount")]
    result = compare(observed, baseline)
    assert len(result.changed_features) == 1
    assert result.changed_features[0].deviation_level == "high"
    assert result.behavioral_risk_score == 1.0  # capped


def test_single_wild_feature_cannot_saturate_score_alone_when_others_are_normal():
    baseline = {
        "log_amount": _baseline_entry("log_amount", count=50, mean=5.0, stddev=1.0),
        "beneficiary_familiarity": _baseline_entry("beneficiary_familiarity", count=50, mean=2.0, stddev=0.5),
    }
    observed = [
        FeatureValue(name="log_amount", value=100.0, group="amount"),  # extreme
        FeatureValue(name="beneficiary_familiarity", value=2.05, group="beneficiary"),  # normal
    ]
    result = compare(observed, baseline)
    # averaged across 2 features (one capped at z=5, one ~0) -> well below 1.0
    assert 0.0 < result.behavioral_risk_score < 1.0
