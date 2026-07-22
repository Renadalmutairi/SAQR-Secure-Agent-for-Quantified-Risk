from app.domain.entities import FeatureValue, TransactionEvent
from app.features.base import FeatureContext, FeatureGroup


class VelocityFeatures(FeatureGroup):
    """Frequency/velocity signal available without real calendar timestamps.

    The source data only has a synthetic step index, so this measures gaps and
    sequence position rather than true elapsed time - swap in wall-clock gaps once
    real timestamps exist, without changing anything downstream.
    """

    name = "velocity"

    def extract(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]:
        features = [
            FeatureValue(name="tx_sequence_index", value=float(context.tx_count_so_far), group=self.name)
        ]
        if context.last_tx_step is not None and event.raw_timestamp_step is not None:
            gap = max(event.raw_timestamp_step - context.last_tx_step, 0)
            features.append(FeatureValue(name="inter_tx_gap_steps", value=float(gap), group=self.name))
        return features
