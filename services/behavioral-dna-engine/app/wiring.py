from dataclasses import dataclass, field

from aiokafka import AIOKafkaProducer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.config import Settings
from app.domain.ports import Cache, CustomerAccountRepository, EventPublisher
from app.features.base import FeatureRegistry
from app.features.defaults import build_default_registry
from app.infra.cache.redis_cache import RedisCache
from app.infra.db.base import build_engine, build_session_factory
from app.infra.db.checkpoint_store import CheckpointStore
from app.infra.db.postgres_customer_account_repository import PostgresCustomerAccountRepository
from app.infra.db.postgres_profile_repository import PostgresProfileRepository
from app.infra.db.token_repository import PostgresTokenRepository
from app.infra.events.kafka_publisher import KafkaEventPublisher
from app.infra.events.noop_publisher import NoOpPublisher
from app.infra.memory.in_memory_cache import InMemoryCache
from app.ingestion.pipeline.coordinator import BackfillPipeline
from app.profile.service import BehavioralDnaService
from app.token_station.service import TokenStationService


@dataclass
class Container:
    """Composition root: everything the API layer needs, built once at startup."""

    settings: Settings
    registry: FeatureRegistry
    profiles: PostgresProfileRepository
    customer_accounts: CustomerAccountRepository
    cache: Cache
    publisher: EventPublisher
    service: BehavioralDnaService
    token_station: TokenStationService
    session_factory: async_sessionmaker
    checkpoint_store: CheckpointStore
    engine: AsyncEngine | None = None
    redis_client: Redis | None = None
    kafka_producer: AIOKafkaProducer | None = None
    active_backfills: dict[str, BackfillPipeline] = field(default_factory=dict)

    def new_backfill_pipeline(self, run_id: str, csv_path: str) -> BackfillPipeline:
        pipeline = BackfillPipeline(
            run_id=run_id,
            csv_path=csv_path,
            registry=self.registry,
            settings=self.settings,
            profiles_repo=self.profiles,
            publisher=self.publisher,
            session_factory=self.session_factory,
            checkpoint_store=self.checkpoint_store,
        )
        self.active_backfills[run_id] = pipeline
        return pipeline

    async def shutdown(self) -> None:
        if self.kafka_producer is not None:
            await self.kafka_producer.stop()
        if self.redis_client is not None:
            await self.redis_client.aclose()
        if self.engine is not None:
            await self.engine.dispose()


async def build_container(settings: Settings) -> Container:
    registry = build_default_registry()

    engine = build_engine(settings.db_dsn, pool_size=settings.db_pool_size, max_overflow=settings.db_max_overflow)
    session_factory: async_sessionmaker = build_session_factory(engine)
    profiles = PostgresProfileRepository(session_factory)
    customer_accounts: CustomerAccountRepository = PostgresCustomerAccountRepository(session_factory)
    token_repository = PostgresTokenRepository(session_factory)
    checkpoint_store = CheckpointStore()

    redis_client: Redis | None = None
    cache: Cache
    if settings.redis_enabled:
        redis_client = Redis.from_url(settings.redis_url, max_connections=settings.redis_max_connections)
        cache = RedisCache(redis_client)
    else:
        cache = InMemoryCache()

    kafka_producer: AIOKafkaProducer | None = None
    publisher: EventPublisher
    if settings.kafka_enabled:
        kafka_producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            acks=settings.kafka_acks,
            linger_ms=settings.kafka_linger_ms,
        )
        await kafka_producer.start()
        publisher = KafkaEventPublisher(kafka_producer, settings.kafka_output_topic)
    else:
        publisher = NoOpPublisher()

    service = BehavioralDnaService(
        registry=registry,
        profiles=profiles,
        customer_accounts=customer_accounts,
        cache=cache,
        publisher=publisher,
        settings=settings,
    )
    token_station = TokenStationService(repository=token_repository, customer_accounts=customer_accounts)

    return Container(
        settings=settings,
        registry=registry,
        profiles=profiles,
        customer_accounts=customer_accounts,
        cache=cache,
        publisher=publisher,
        service=service,
        token_station=token_station,
        session_factory=session_factory,
        checkpoint_store=checkpoint_store,
        engine=engine,
        redis_client=redis_client,
        kafka_producer=kafka_producer,
    )
