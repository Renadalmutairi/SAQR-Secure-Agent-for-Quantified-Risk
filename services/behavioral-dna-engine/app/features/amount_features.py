import math

from app.domain.entities import FeatureValue, TransactionEvent
from app.features.base import FeatureContext, FeatureGroup


class AmountFeatures(FeatureGroup):
    name = "amount"

    def extract(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]:
        # log1p tames the heavy-tailed amount distribution (median ~168, max ~11.4M in
        # observed data) so a few extreme legitimate transfers don't blow out the
        # streaming variance used for every later deviation comparison.
        log_amount = math.log1p(max(event.amount, 0.0))
        return [FeatureValue(name="log_amount", value=log_amount, group=self.name)]
