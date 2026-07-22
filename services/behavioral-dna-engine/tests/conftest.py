import pytest

from app.config import Settings
from app.features.defaults import build_default_registry
from app.infra.events.noop_publisher import NoOpPublisher
from app.infra.memory.in_memory_cache import InMemoryCache
from app.infra.memory.in_memory_customer_account_repository import InMemoryCustomerAccountRepository
from app.infra.memory.in_memory_profile_repository import InMemoryProfileRepository
from app.profile.service import BehavioralDnaService


@pytest.fixture
def settings() -> Settings:
    return Settings(min_history_for_full_confidence=5, redis_enabled=False, kafka_enabled=False)


@pytest.fixture
def profiles():
    return InMemoryProfileRepository()


@pytest.fixture
def customer_accounts():
    return InMemoryCustomerAccountRepository()


@pytest.fixture
def cache():
    return InMemoryCache()


@pytest.fixture
def publisher():
    return NoOpPublisher()


@pytest.fixture
def service(settings, profiles, customer_accounts, cache, publisher) -> BehavioralDnaService:
    registry = build_default_registry()
    return BehavioralDnaService(
        registry=registry,
        profiles=profiles,
        customer_accounts=customer_accounts,
        cache=cache,
        publisher=publisher,
        settings=settings,
    )
