from app.domain.entities import BehavioralDnaProfile
from app.domain.ports import Cache


class InMemoryCache(Cache):
    """Fake Cache for tests / local dev without Redis. Never the source of truth."""

    def __init__(self) -> None:
        self._current: dict[str, BehavioralDnaProfile] = {}

    async def get_current_profile(self, customer_id: str) -> BehavioralDnaProfile | None:
        return self._current.get(customer_id)

    async def set_current_profile(self, profile: BehavioralDnaProfile) -> None:
        self._current[profile.customer_id] = profile
