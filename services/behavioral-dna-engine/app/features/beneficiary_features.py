import math

from app.domain.entities import FeatureValue, TransactionEvent
from app.features.base import FeatureContext, FeatureGroup


class BeneficiaryFeatures(FeatureGroup):
    """'Does this customer usually pay this beneficiary?' signal.

    Observed data has 5,891 unique sender-receiver pairs, most (5,208) repeated -
    this is a genuinely strong signal even without device/geo data.
    """

    name = "beneficiary"

    def extract(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]:
        prior_count = context.trusted_beneficiaries.get(event.receiver_account_id, 0)
        is_new = 1.0 if prior_count == 0 else 0.0
        familiarity = math.log1p(prior_count)
        return [
            FeatureValue(name="beneficiary_is_new", value=is_new, group=self.name),
            FeatureValue(name="beneficiary_familiarity", value=familiarity, group=self.name),
        ]
