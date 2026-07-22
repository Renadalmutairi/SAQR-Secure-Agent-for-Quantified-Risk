"""Per-transaction / per-annotation processing. Everything here is bounded to the
local neighborhood of one account: one topology upsert, one edge read+write, one
local structural-feature query. No graph-wide traversal ever happens here - that's
the cold path's job.
"""

import logging

from app.domain.entities import BehavioralAnnotation, RawTransactionEvent
from app.domain.ports import GraphStore, OutputPublisher
from app.graph.complexity import DEFAULT_COMPLEXITY_CONFIG, ComplexityConfig, should_expand_neighborhood
from app.graph.edge_updater import apply_behavioral_annotation_to_edge, next_edge_properties_for_transaction

logger = logging.getLogger(__name__)


class HotPathProcessor:
    def __init__(
        self,
        graph_store: GraphStore,
        output_publisher: OutputPublisher,
        complexity_config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
    ) -> None:
        self._graph_store = graph_store
        self._output_publisher = output_publisher
        self._complexity_config = complexity_config

    async def process_raw_transaction(self, event: RawTransactionEvent) -> None:
        await self._graph_store.upsert_transaction_topology(event)

        previous = await self._graph_store.get_edge_stored_properties(
            event.sender_account_id, event.receiver_account_id
        )
        next_props = next_edge_properties_for_transaction(previous, event)
        await self._graph_store.write_edge_stored_properties(
            event.sender_account_id, event.receiver_account_id, next_props
        )

        features = await self._graph_store.get_local_structural_features(event.sender_account_id)
        if should_expand_neighborhood(features.structural_complexity_score, self._complexity_config):
            await self._graph_store.mark_pending_expansion(event.sender_account_id)
            logger.info(
                "account %s flagged for deep expansion (complexity=%.2f, fan_in=%s, fan_out=%s)",
                event.sender_account_id, features.structural_complexity_score, features.fan_in, features.fan_out,
            )

        # Publish structural intelligence for this transaction's sender - the
        # actual point of this agent (Trust Agent / GNN consume this downstream).
        output = await self._graph_store.get_output_for_entity(
            event.sender_account_id, entity_type="Account", transaction_id=event.tx_id
        )
        await self._output_publisher.publish(output)

    async def process_behavioral_annotation(self, annotation: BehavioralAnnotation) -> None:
        await self._graph_store.apply_behavioral_annotation(annotation)

        previous = await self._graph_store.get_edge_stored_properties(
            annotation.account_id, annotation.receiver_account_id
        )
        if previous is None:
            # Annotation arrived before the corresponding raw transaction created
            # this edge - skip the edge-level EWMA this time, the topology and
            # later annotations will catch up. Loosely correlated by design.
            return

        next_props = apply_behavioral_annotation_to_edge(previous, annotation)
        await self._graph_store.write_edge_stored_properties(
            annotation.account_id, annotation.receiver_account_id, next_props
        )
