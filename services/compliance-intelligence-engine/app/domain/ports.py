from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel

from app.domain.entities import (
    BehavioralSnapshot,
    ComplianceEvaluationRequest,
    CustomerProfileSnapshot,
    PolicyRule,
    RuleVerdictStatus,
    StructuralSnapshot,
    TrustSnapshot,
)


class EvaluationContext(BaseModel):
    """Everything a trigger evaluator needs, fetched ONCE per evaluation
    (Agent 1, Agent 2, Agent 3, and the customer profile provider, concurrently)
    and shared across every rule - evaluators never make their own I/O calls."""

    request: ComplianceEvaluationRequest
    behavioral: BehavioralSnapshot | None
    structural: StructuralSnapshot | None
    trust: TrustSnapshot | None
    customer_profile: CustomerProfileSnapshot | None


class PolicyProvider(ABC):
    @abstractmethod
    def get_rules(self) -> list[PolicyRule]:
        """Loaded once at startup from compliance_policies/registry/*.yaml -
        a static configuration load, not a runtime cache."""


class TriggerEvaluator(ABC):
    """One evaluator per PolicyRule.trigger value - a pure function over
    EvaluationContext, no I/O. Rules whose trigger has no registered evaluator
    default to UNEVALUATED (see RuleEvaluationEngine) rather than a false pass -
    most of the 30 registry rules are institutional/process rules that
    genuinely cannot be verified from a single transaction's data, and staying
    honest about that is the whole point of separating passed/violated/
    unevaluated in the output contract.
    """

    trigger_name: str

    @abstractmethod
    def evaluate(self, rule: PolicyRule, context: EvaluationContext) -> tuple[RuleVerdictStatus, str]:
        """Returns (status, human-readable reason)."""


class BehavioralDnaClient(ABC):
    @abstractmethod
    async def get_profile(self, customer_id: str) -> BehavioralSnapshot | None:
        """None on any failure - callers must degrade gracefully."""


class GraphIntelligenceClient(ABC):
    @abstractmethod
    async def get_output(self, account_id: str) -> StructuralSnapshot | None:
        """None on any failure."""


class TrustIntelligenceClient(ABC):
    @abstractmethod
    async def evaluate_trust(self, transaction_id: str, customer_id: str, account_id: str) -> TrustSnapshot | None:
        """None on any failure."""


class CustomerProfileProvider(ABC):
    @abstractmethod
    async def get_profile(self, customer_id: str) -> CustomerProfileSnapshot | None:
        """None always in v1 (mock) - no KYC/customer-master system exists in
        SAQR yet. Real implementation plugs in here without touching the rule
        engine, same reserved-extension-point pattern used throughout SAQR."""
