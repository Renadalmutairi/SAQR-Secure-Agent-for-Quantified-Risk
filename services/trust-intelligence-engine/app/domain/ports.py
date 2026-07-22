from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel

from app.domain.entities import (
    BehavioralProfileSnapshot,
    Evidence,
    EvidenceType,
    GraphOutputSnapshot,
    HistoricalSignals,
    TrustEvaluationRequest,
)


class EvidenceContext(BaseModel):
    """Everything a provider needs, fetched ONCE per evaluation (Agent 1 and
    Agent 2 concurrently, via asyncio.gather) and shared across every provider -
    providers never make their own I/O calls, which is what keeps per-transaction
    complexity at exactly two HTTP round trips regardless of how many providers
    exist.
    """

    request: TrustEvaluationRequest
    profile: BehavioralProfileSnapshot | None
    graph_output: GraphOutputSnapshot | None


class EvidenceProvider(ABC):
    source: EvidenceType
    default_weight: float

    @abstractmethod
    def get_evidence(self, context: EvidenceContext) -> Evidence:
        """Pure function over already-fetched context - no I/O, no async."""


class BehavioralDnaClient(ABC):
    @abstractmethod
    async def get_profile(self, customer_id: str) -> BehavioralProfileSnapshot | None:
        """None on any failure (timeout, 404, connection error, etc) - callers
        must degrade gracefully, never raise up into the evaluation."""


class GraphIntelligenceClient(ABC):
    @abstractmethod
    async def get_output(self, account_id: str) -> GraphOutputSnapshot | None:
        """None on any failure - same graceful-degradation contract as above."""


class HistoricalSignalSource(ABC):
    """Where HistoricalTrustEvidenceProvider gets its raw signals from - kept
    separate from the provider itself so the provider's public shape
    (get_evidence) never changes as real signal sources come online (previous
    Trust/Behavioral/Structural scores). Swapping this implementation is the
    only thing that changes; the fusion engine and the provider are untouched.
    """

    @abstractmethod
    def get_signals(self, context: EvidenceContext) -> HistoricalSignals:
        """Pure function over context - no I/O. A future source that reads
        previous scores from persisted state would still be handed the same
        context and return the richer HistoricalSignals; if it needs its own
        I/O (e.g. a DB read), that happens upstream when context is built, not
        here - this stays a pure function like every other provider-adjacent
        piece in this agent.
        """
