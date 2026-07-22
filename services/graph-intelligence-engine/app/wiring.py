from dataclasses import dataclass, field

from aiokafka import AIOKafkaProducer
from neo4j import AsyncDriver, AsyncGraphDatabase

from app.config import Settings
from app.domain.ports import GraphStore
from app.graph.cold_path import ColdPathConfig, ColdPathRunner
from app.graph.enrichers import build_reserved_enrichers
from app.graph.hot_path import HotPathProcessor
from app.infra.kafka.behavioral_annotation_consumer import KafkaBehavioralAnnotationSource
from app.infra.kafka.output_publisher import KafkaOutputPublisher
from app.infra.kafka.raw_tx_consumer import KafkaRawTransactionSource
from app.infra.neo4j.graph_store import Neo4jGraphStore
from app.infra.neo4j.schema import apply_schema


@dataclass
class Container:
    settings: Settings
    driver: AsyncDriver
    graph_store: GraphStore
    hot_path: HotPathProcessor
    cold_path: ColdPathRunner
    raw_tx_source: KafkaRawTransactionSource
    behavioral_source: KafkaBehavioralAnnotationSource
    output_publisher: KafkaOutputPublisher
    kafka_producer: AIOKafkaProducer
    enrichers: list = field(default_factory=list)

    async def shutdown(self) -> None:
        await self.kafka_producer.stop()
        await self.driver.close()


async def build_container(settings: Settings) -> Container:
    driver = AsyncGraphDatabase.driver(settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password))
    await apply_schema(driver)

    graph_store = Neo4jGraphStore(driver)

    kafka_producer = AIOKafkaProducer(bootstrap_servers=settings.kafka_bootstrap_servers)
    await kafka_producer.start()
    output_publisher = KafkaOutputPublisher(kafka_producer, settings.output_topic)

    hot_path = HotPathProcessor(graph_store, output_publisher)
    cold_path = ColdPathRunner(
        graph_store,
        ColdPathConfig(
            embedding_dimensions=settings.embedding_dimensions,
            sparsify_min_weight=settings.sparsify_min_weight,
            sparsify_max_age_days=settings.sparsify_max_age_days,
            expansion_hop=settings.expansion_hop,
        ),
    )

    raw_tx_source = KafkaRawTransactionSource(
        settings.kafka_bootstrap_servers, settings.raw_tx_topic, f"{settings.consumer_group_id}-raw-tx"
    )
    behavioral_source = KafkaBehavioralAnnotationSource(
        settings.kafka_bootstrap_servers, settings.behavioral_dna_topic, f"{settings.consumer_group_id}-behavioral"
    )

    return Container(
        settings=settings,
        driver=driver,
        graph_store=graph_store,
        hot_path=hot_path,
        cold_path=cold_path,
        raw_tx_source=raw_tx_source,
        behavioral_source=behavioral_source,
        output_publisher=output_publisher,
        kafka_producer=kafka_producer,
        enrichers=build_reserved_enrichers(),
    )
