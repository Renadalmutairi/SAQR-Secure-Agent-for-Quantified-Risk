from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.entities import FeatureValue, TransactionEvent


class FeatureContext:
    """Per-account rolling context available to feature groups during extraction."""

    def __init__(
        self,
        account_id: str,
        trusted_beneficiaries: dict[str, int],
        last_tx_step: int | None = None,
        tx_count_so_far: int = 0,
    ) -> None:
        self.account_id = account_id
        self.trusted_beneficiaries = trusted_beneficiaries
        self.last_tx_step = last_tx_step
        self.tx_count_so_far = tx_count_so_far


class FeatureGroup(ABC):
    """A cohesive set of behavioral features computed from one input signal.

    New feature groups (device, geo, session) plug in here without the profile
    builder/updater/comparator ever changing - they only ever consume FeatureValue.
    """

    name: str
    enabled: bool = True

    @abstractmethod
    def extract(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]: ...


class FeatureRegistry:
    def __init__(self) -> None:
        self._groups: list[FeatureGroup] = []

    def register(self, group: FeatureGroup) -> None:
        self._groups.append(group)

    def extract_all(self, event: TransactionEvent, context: FeatureContext) -> list[FeatureValue]:
        features: list[FeatureValue] = []
        for group in self._groups:
            if group.enabled:
                features.extend(group.extract(event, context))
        return features

    @property
    def groups(self) -> list[FeatureGroup]:
        return list(self._groups)
