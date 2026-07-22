from datetime import UTC, datetime

from neo4j import AsyncDriver

from app.domain.entities import (
    BehavioralAnnotation,
    EdgeDerivedMetrics,
    EdgeStoredProperties,
    GraphIntelligenceOutput,
    RawTransactionEvent,
    StructuralAnomaly,
    StructuralFeatures,
    WelfordState,
)
from app.domain.ports import GraphStore
from app.graph.complexity import DEFAULT_COMPLEXITY_CONFIG, should_expand_neighborhood, structural_complexity_score
from app.graph.trust_score import compute_edge_derived_metrics
from app.infra.neo4j import queries

_PROJECTION_NAME = "accountGraph"

# Anomaly thresholds - deliberately simple/configurable constants for v1, not
# statistically fitted. Reports observations; never a fraud verdict.
_HUB_DEGREE_THRESHOLD = 50
_FAN_THRESHOLD = 20
_BETWEENNESS_THRESHOLD = 0.1


def _neo4j_dt_to_native(value) -> datetime | None:
    if value is None:
        return None
    return value.to_native() if hasattr(value, "to_native") else value


def _row_to_edge_properties(record) -> EdgeStoredProperties | None:
    if record is None or record["interaction_count"] is None:
        return None
    return EdgeStoredProperties(
        interaction_count=record["interaction_count"],
        total_amount=record["total_amount"],
        first_seen=_neo4j_dt_to_native(record["first_seen"]),
        last_seen=_neo4j_dt_to_native(record["last_seen"]),
        behavioral_similarity_ewma=record["behavioral_similarity_ewma"],
        behavioral_confidence_ewma=record["behavioral_confidence_ewma"],
        behavioral_risk_ewma=record["behavioral_risk_ewma"],
        gap_seconds_stats=WelfordState(
            count=record["gap_count"] or 0, mean=record["gap_mean"] or 0.0, m2=record["gap_m2"] or 0.0
        ),
        amount_log_stats=WelfordState(
            count=record["amount_log_count"] or 0,
            mean=record["amount_log_mean"] or 0.0,
            m2=record["amount_log_m2"] or 0.0,
        ),
    )


class Neo4jGraphStore(GraphStore):
    def __init__(self, driver: AsyncDriver) -> None:
        self._driver = driver

    async def upsert_transaction_topology(self, event: RawTransactionEvent) -> None:
        async with self._driver.session() as session:
            await session.run(
                queries.UPSERT_TOPOLOGY,
                sender_account_id=event.sender_account_id,
                receiver_account_id=event.receiver_account_id,
                tx_id=event.tx_id,
                tx_type=event.tx_type,
                amount=event.amount,
                occurred_at=event.occurred_at.isoformat(),
            )

    async def get_edge_stored_properties(
        self, sender_account_id: str, receiver_account_id: str
    ) -> EdgeStoredProperties | None:
        async with self._driver.session() as session:
            result = await session.run(
                queries.GET_EDGE_PROPERTIES, sender_account_id=sender_account_id, receiver_account_id=receiver_account_id
            )
            record = await result.single()
            return _row_to_edge_properties(record)

    async def write_edge_stored_properties(
        self, sender_account_id: str, receiver_account_id: str, properties: EdgeStoredProperties
    ) -> None:
        async with self._driver.session() as session:
            await session.run(
                queries.WRITE_EDGE_PROPERTIES,
                sender_account_id=sender_account_id,
                receiver_account_id=receiver_account_id,
                interaction_count=properties.interaction_count,
                total_amount=properties.total_amount,
                first_seen=properties.first_seen.isoformat(),
                last_seen=properties.last_seen.isoformat(),
                behavioral_similarity_ewma=properties.behavioral_similarity_ewma,
                behavioral_confidence_ewma=properties.behavioral_confidence_ewma,
                behavioral_risk_ewma=properties.behavioral_risk_ewma,
                gap_count=properties.gap_seconds_stats.count,
                gap_mean=properties.gap_seconds_stats.mean,
                gap_m2=properties.gap_seconds_stats.m2,
                amount_log_count=properties.amount_log_stats.count,
                amount_log_mean=properties.amount_log_stats.mean,
                amount_log_m2=properties.amount_log_stats.m2,
            )

    async def get_edge_derived_metrics(
        self, sender_account_id: str, receiver_account_id: str
    ) -> EdgeDerivedMetrics | None:
        props = await self.get_edge_stored_properties(sender_account_id, receiver_account_id)
        if props is None:
            return None
        return compute_edge_derived_metrics(props, now=datetime.now(UTC))

    async def get_average_outgoing_trust_score(self, account_id: str) -> float | None:
        async with self._driver.session() as session:
            result = await session.run(queries.GET_OUTGOING_EDGE_PROPERTIES, account_id=account_id)
            records = [r async for r in result]

        now = datetime.now(UTC)
        scores = []
        for record in records:
            props = _row_to_edge_properties(record)
            if props is not None:
                scores.append(compute_edge_derived_metrics(props, now=now).structural_trust_score)

        return sum(scores) / len(scores) if scores else None

    async def apply_behavioral_annotation(self, annotation: BehavioralAnnotation) -> None:
        async with self._driver.session() as session:
            await session.run(
                queries.APPLY_CUSTOMER_SNAPSHOT,
                customer_id=annotation.customer_id,
                account_id=annotation.account_id,
                behavioral_risk_score=annotation.behavioral_risk_score,
                confidence_score=annotation.confidence_score,
                similarity_score=annotation.similarity_score,
                profile_version=annotation.profile_version,
                behavioral_updated_at=annotation.generated_at.isoformat(),
            )

    async def get_local_structural_features(self, account_id: str, hop: int = 2) -> StructuralFeatures:
        async with self._driver.session() as session:
            degree_result = await (await session.run(queries.LOCAL_DEGREE_STATS, account_id=account_id)).single()
            clustering_result = await (
                await session.run(queries.LOCAL_CLUSTERING_COEFFICIENT, account_id=account_id)
            ).single()
            shared_result = await (
                await session.run(queries.SHARED_BENEFICIARY_COUNT, account_id=account_id)
            ).single()
            cold_path_result = await (
                await session.run(queries.GET_NODE_COLD_PATH_RESULTS, account_id=account_id)
            ).single()

        fan_in = degree_result["fan_in"] or 0 if degree_result else 0
        fan_out = degree_result["fan_out"] or 0 if degree_result else 0
        complexity_score = structural_complexity_score(fan_in, fan_out, DEFAULT_COMPLEXITY_CONFIG)

        community_id = cold_path_result["community_id"] if cold_path_result else None
        community_size = None
        if community_id is not None:
            async with self._driver.session() as session:
                size_record = await (
                    await session.run(queries.GET_COMMUNITY_SIZE, community_id=community_id)
                ).single()
                community_size = size_record["community_size"] if size_record else None

        return StructuralFeatures(
            degree=degree_result["degree"] or 0 if degree_result else 0,
            weighted_degree=degree_result["weighted_degree"] or 0.0 if degree_result else 0.0,
            fan_in=fan_in,
            fan_out=fan_out,
            clustering_coefficient=clustering_result["clustering_coefficient"] if clustering_result else 0.0,
            shared_beneficiary_count=shared_result["shared_beneficiary_count"] if shared_result else 0,
            community_id=str(community_id) if community_id is not None else None,
            community_size=community_size,
            pagerank=cold_path_result["pagerank"] if cold_path_result else None,
            betweenness=cold_path_result["betweenness"] if cold_path_result else None,
            eigenvector=cold_path_result["eigenvector"] if cold_path_result else None,
            structural_complexity_score=complexity_score,
        )

    async def mark_pending_expansion(self, account_id: str) -> None:
        async with self._driver.session() as session:
            await session.run(queries.MARK_PENDING_EXPANSION, account_id=account_id)

    async def run_community_detection(self) -> int:
        async with self._driver.session() as session:
            await self._ensure_projection(session)
            result = await (await session.run(queries.RUN_LOUVAIN, graph_name=_PROJECTION_NAME)).single()
            return result["communityCount"] if result else 0

    async def run_centrality_measures(self) -> None:
        async with self._driver.session() as session:
            await self._ensure_projection(session)
            await session.run(queries.RUN_PAGERANK, graph_name=_PROJECTION_NAME)
            await session.run(queries.RUN_BETWEENNESS, graph_name=_PROJECTION_NAME)
            await session.run(queries.RUN_EIGENVECTOR, graph_name=_PROJECTION_NAME)

    async def run_embeddings(self, dimensions: int) -> None:
        async with self._driver.session() as session:
            await self._ensure_projection(session)
            await session.run(queries.RUN_FASTRP, graph_name=_PROJECTION_NAME, dimensions=dimensions)

    async def sparsify(self, min_weight: float, max_age_days: int) -> int:
        cutoff = datetime.now(UTC).timestamp() - max_age_days * 86400
        cutoff_iso = datetime.fromtimestamp(cutoff, tz=UTC).isoformat()
        removed_total = 0
        async with self._driver.session() as session:
            while True:
                result = await session.run(queries.SPARSIFY_EDGES, min_weight=min_weight, cutoff=cutoff_iso)
                record = await result.single()
                removed = record["removed"] if record else 0
                removed_total += removed
                if removed < 10000:
                    break
        return removed_total

    async def drain_pending_expansions(self) -> list[str]:
        async with self._driver.session() as session:
            result = await session.run(queries.DRAIN_PENDING_EXPANSIONS)
            records = [r async for r in result]
            return [r["account_id"] for r in records]

    async def expand_neighborhood(self, account_id: str, hop: int) -> StructuralFeatures:
        query = queries.EXPANDED_NEIGHBORHOOD_PLAIN % hop
        async with self._driver.session() as session:
            await session.run(query, account_id=account_id)
        # Deeper exploration currently records reach; full feature set still
        # comes from get_local_structural_features (cheap, always accurate for
        # the direct 2-hop neighborhood the hot path already trusts).
        return await self.get_local_structural_features(account_id, hop=hop)

    async def get_output_for_entity(
        self, entity_id: str, entity_type: str, transaction_id: str | None = None
    ) -> GraphIntelligenceOutput:
        features = await self.get_local_structural_features(entity_id)
        async with self._driver.session() as session:
            embedding_record = await (
                await session.run(queries.GET_NODE_COLD_PATH_RESULTS, account_id=entity_id)
            ).single()
        embedding = list(embedding_record["embedding"]) if embedding_record and embedding_record["embedding"] else []

        avg_trust_score = await self.get_average_outgoing_trust_score(entity_id)
        neighborhood_stats = {"avg_outgoing_trust_score": avg_trust_score} if avg_trust_score is not None else {}

        return GraphIntelligenceOutput(
            entity_id=entity_id,
            entity_type=entity_type,
            transaction_id=transaction_id,
            graph_embedding=embedding,
            neighborhood_stats=neighborhood_stats,
            structural_features=features,
            community_id=features.community_id,
            community_size=features.community_size,
            graph_confidence_score=1.0 if features.degree > 0 else 0.0,
            generated_at=datetime.now(UTC),
        )

    async def detect_structural_anomalies(self) -> list[StructuralAnomaly]:
        now = datetime.now(UTC)
        anomalies: list[StructuralAnomaly] = []

        async with self._driver.session() as session:
            hubs = await session.run(queries.DETECT_HUB_ACCOUNTS, degree_threshold=_HUB_DEGREE_THRESHOLD)
            async for r in hubs:
                anomalies.append(
                    StructuralAnomaly(
                        anomaly_type="hub_formation", entity_id=r["account_id"], entity_type="Account",
                        score=float(r["degree"]), description=f"Degree {r['degree']} exceeds hub threshold",
                        detected_at=now,
                    )
                )

            fan_ins = await session.run(queries.DETECT_FAN_IN_SPIKES, fan_threshold=_FAN_THRESHOLD)
            async for r in fan_ins:
                anomalies.append(
                    StructuralAnomaly(
                        anomaly_type="multi_to_one_convergence", entity_id=r["account_id"], entity_type="Account",
                        score=float(r["fan_in"]), description=f"Fan-in {r['fan_in']} - many accounts converge here",
                        detected_at=now,
                    )
                )

            fan_outs = await session.run(queries.DETECT_FAN_OUT_SPIKES, fan_threshold=_FAN_THRESHOLD)
            async for r in fan_outs:
                anomalies.append(
                    StructuralAnomaly(
                        anomaly_type="one_to_many_dispersion", entity_id=r["account_id"], entity_type="Account",
                        score=float(r["fan_out"]), description=f"Fan-out {r['fan_out']} - disperses to many accounts",
                        detected_at=now,
                    )
                )

            bridges = await session.run(
                queries.DETECT_BRIDGE_ACCOUNTS, betweenness_threshold=_BETWEENNESS_THRESHOLD
            )
            async for r in bridges:
                anomalies.append(
                    StructuralAnomaly(
                        anomaly_type="bridge_account", entity_id=r["account_id"], entity_type="Account",
                        score=float(r["betweenness"]), description="High betweenness - connects otherwise separate parts of the graph",
                        detected_at=now,
                    )
                )

            chains = await session.run(queries.DETECT_SHORT_CIRCULAR_CHAINS)
            async for r in chains:
                anomalies.append(
                    StructuralAnomaly(
                        anomaly_type="circular_transaction_chain", entity_id=r["account_id"], entity_type="Account",
                        score=float(r["chain_length"]), description=f"Money returns to origin after {r['chain_length']} hops",
                        detected_at=now,
                    )
                )

        return anomalies

    async def _ensure_projection(self, session) -> None:
        try:
            await session.run(queries.DROP_GRAPH_PROJECTION, graph_name=_PROJECTION_NAME)
        except Exception:
            pass
        await session.run(queries.PROJECT_ACCOUNT_GRAPH, graph_name=_PROJECTION_NAME)
