from app.domain.entities import FeatureValue, TransactionEvent
from app.features.base import FeatureContext, FeatureGroup


class StructuralFeatures(FeatureGroup):
    """Transaction-shape signals independent of amount or timing.

    118 of 117,533 observed transactions are self-loops (sender == receiver) -
    rare enough to be a meaningful behavioral marker rather than noise.
    """

    name = "structural"

    def extract(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]:
        is_self_loop = 1.0 if event.sender_account_id == event.receiver_account_id else 0.0
        return [FeatureValue(name="is_self_loop", value=is_self_loop, group=self.name)]
