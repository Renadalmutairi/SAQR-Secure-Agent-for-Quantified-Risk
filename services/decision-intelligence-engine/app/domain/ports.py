from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel

from app.domain.entities import (
    BehavioralSnapshot,
    ComplianceSnapshot,
    DecisionRequest,
    GraphSnapshot,
    TrustSnapshot,
)


class EvidenceContext(BaseModel):
    """Everything the fusion engine needs, fetched ONCE per decision (Agent
    1, 2, 3, 4, concurrently) and shared across every evidence provider -
    providers never make their own I/O calls."""

    request: DecisionRequest
    behavioral: BehavioralSnapshot | None
    graph: GraphSnapshot | None
    trust: TrustSnapshot | None
    compliance: ComplianceSnapshot | None


class BehavioralDnaClient(ABC):
    @abstractmethod
    async def get_profile(self, customer_id: str) -> BehavioralSnapshot | None:
        """None on any failure - callers must degrade gracefully."""


class GraphIntelligenceClient(ABC):
    @abstractmethod
    async def get_output(self, account_id: str) -> GraphSnapshot | None:
        """None on any failure."""


class TrustIntelligenceClient(ABC):
    @abstractmethod
    async def evaluate_trust(self, transaction_id: str, customer_id: str, account_id: str) -> TrustSnapshot | None:
        """None on any failure."""


class ComplianceClient(ABC):
    @abstractmethod
    async def evaluate_compliance(self, request: DecisionRequest) -> ComplianceSnapshot | None:
        """None on any failure."""
