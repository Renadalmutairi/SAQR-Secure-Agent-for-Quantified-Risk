from app.features.amount_features import AmountFeatures
from app.features.base import FeatureRegistry
from app.features.beneficiary_features import BeneficiaryFeatures
from app.features.reserved import DeviceFeatures, GeoFeatures, SessionFeatures, TemporalFeatures
from app.features.structural_features import StructuralFeatures
from app.features.velocity_features import VelocityFeatures


def build_default_registry() -> FeatureRegistry:
    registry = FeatureRegistry()
    registry.register(AmountFeatures())
    registry.register(VelocityFeatures())
    registry.register(BeneficiaryFeatures())
    registry.register(StructuralFeatures())
    # Reserved groups register now (so the schema and registry both know about
    # them) but stay disabled until their data source exists.
    registry.register(TemporalFeatures())
    registry.register(DeviceFeatures())
    registry.register(GeoFeatures())
    registry.register(SessionFeatures())
    return registry
