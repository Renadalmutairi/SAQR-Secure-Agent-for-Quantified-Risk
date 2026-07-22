"""Scheduled batch job - the ONLY place graph-wide/GDS-projection algorithms run.
Never invoked per-transaction. This is what makes 'continuously identify
communities' and 'energy-efficient, local-only hot path' coexist.
"""

import logging
from dataclasses import dataclass

from app.domain.entities import StructuralAnomaly
from app.domain.ports import GraphStore

logger = logging.getLogger(__name__)


@dataclass
class ColdPathConfig:
    embedding_dimensions: int = 128
    sparsify_min_weight: float = 1.0
    sparsify_max_age_days: int = 180
    expansion_hop: int = 4


@dataclass
class ColdPathRunSummary:
    community_count: int
    edges_removed: int
    expansions_processed: int
    anomalies_found: int


class ColdPathRunner:
    def __init__(self, graph_store: GraphStore, config: ColdPathConfig | None = None) -> None:
        self._graph_store = graph_store
        self._config = config or ColdPathConfig()

    async def run_once(self) -> ColdPathRunSummary:
        logger.info("cold path cycle starting")

        community_count = await self._graph_store.run_community_detection()
        await self._graph_store.run_centrality_measures()
        await self._graph_store.run_embeddings(self._config.embedding_dimensions)
        edges_removed = await self._graph_store.sparsify(
            self._config.sparsify_min_weight, self._config.sparsify_max_age_days
        )

        pending = await self._graph_store.drain_pending_expansions()
        for account_id in pending:
            await self._graph_store.expand_neighborhood(account_id, self._config.expansion_hop)

        anomalies: list[StructuralAnomaly] = await self._graph_store.detect_structural_anomalies()

        summary = ColdPathRunSummary(
            community_count=community_count,
            edges_removed=edges_removed,
            expansions_processed=len(pending),
            anomalies_found=len(anomalies),
        )
        logger.info("cold path cycle done: %s", summary)
        return summary
