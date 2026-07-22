from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from app.domain.entities import (
    BehavioralAnnotation,
    EdgeDerivedMetrics,
    EdgeStoredProperties,
    GraphIntelligenceOutput,
    RawTransactionEvent,
    StructuralAnomaly,
    StructuralFeatures,
)


class RawTransactionSource(ABC):
    @abstractmethod
    def stream(self) -> AsyncIterator[RawTransactionEvent]: ...


class BehavioralAnnotationSource(ABC):
    @abstractmethod
    def stream(self) -> AsyncIterator[BehavioralAnnotation]: ...


class GraphStore(ABC):
    """Neo4j abstraction. This is the ONLY thing that ever issues Cypher - hot
    path and cold path both go through here, never construct queries themselves.
    """

    # --- hot path: local, per-transaction, O(1)/O(neighborhood) ---

    @abstractmethod
    async def upsert_transaction_topology(self, event: RawTransactionEvent) -> None:
        """Merge Customer/Account/Transaction nodes and owns/transfers_to edges
        for one transaction. Does not touch behavioral fields."""

    @abstractmethod
    async def get_edge_stored_properties(
        self, sender_account_id: str, receiver_account_id: str
    ) -> EdgeStoredProperties | None: ...

    @abstractmethod
    async def write_edge_stored_properties(
        self, sender_account_id: str, receiver_account_id: str, properties: EdgeStoredProperties
    ) -> None: ...

    @abstractmethod
    async def get_edge_derived_metrics(
        self, sender_account_id: str, receiver_account_id: str
    ) -> EdgeDerivedMetrics | None:
        """Computes average_amount/relationship_age/time_decay_weight/temporal_consistency/
        transaction_regularity/structural_trust_score from stored properties, at read
        time - see compute_edge_derived_metrics in graph/trust_score.py. None if the
        edge doesn't exist yet."""

    @abstractmethod
    async def get_average_outgoing_trust_score(self, account_id: str) -> float | None:
        """Average Structural Trust Score across an account's outgoing edges -
        surfaced in GraphIntelligenceOutput.neighborhood_stats. None if the
        account has no outgoing edges yet."""

    @abstractmethod
    async def apply_behavioral_annotation(self, annotation: BehavioralAnnotation) -> None:
        """Overwrite the Customer node's long-term snapshot AND fold the
        annotation into the relevant edge's EWMA fields, in one write."""

    @abstractmethod
    async def get_local_structural_features(self, account_id: str, hop: int = 2) -> StructuralFeatures:
        """Degree/fan-in/fan-out/clustering-coefficient etc from a bounded
        hop-limited traversal - never a full graph scan."""

    @abstractmethod
    async def mark_pending_expansion(self, account_id: str) -> None:
        """Flag a node for cold-path deep (3/4-hop) exploration instead of doing
        it inline - keeps the hot path's latency bounded."""

    # --- cold path: scheduled, graph-wide (via GDS projections) ---

    @abstractmethod
    async def run_community_detection(self) -> int:
        """Louvain over a GDS projection. Returns number of communities found."""

    @abstractmethod
    async def run_centrality_measures(self) -> None:
        """PageRank / betweenness / eigenvector via GDS, written back to nodes."""

    @abstractmethod
    async def run_embeddings(self, dimensions: int) -> None:
        """FastRP via GDS, written back to nodes."""

    @abstractmethod
    async def sparsify(self, min_weight: float, max_age_days: int) -> int:
        """Drop edges below a weight/recency threshold. Returns count removed."""

    @abstractmethod
    async def drain_pending_expansions(self) -> list[str]:
        """Return account_ids flagged by mark_pending_expansion, clear the flags."""

    @abstractmethod
    async def expand_neighborhood(self, account_id: str, hop: int) -> StructuralFeatures:
        """Deeper (3/4-hop) exploration for a flagged node - cold path only."""

    @abstractmethod
    async def get_output_for_entity(
        self, entity_id: str, entity_type: str, transaction_id: str | None = None
    ) -> GraphIntelligenceOutput: ...

    @abstractmethod
    async def detect_structural_anomalies(self) -> list[StructuralAnomaly]:
        """Bounded, cheap structural checks (hub formation, fan spikes, bridge
        accounts, short circular chains) - observations only, never a fraud
        verdict. Runs in the cold path over cached/GDS-computed values, not a
        fresh full-graph scan.
        """


class OutputPublisher(ABC):
    @abstractmethod
    async def publish(self, output: GraphIntelligenceOutput) -> None: ...


class NodeEnricher(ABC):
    """Pluggable extension point for node/edge types with no data source yet
    (Device, IP, Merchant, Company, Session, Country) - mirrors Agent 1's
    FeatureGroup registry. Registered but `enabled = False` until real data exists.
    """

    name: str
    enabled: bool = True

    @abstractmethod
    async def enrich(self, event: RawTransactionEvent) -> None: ...
