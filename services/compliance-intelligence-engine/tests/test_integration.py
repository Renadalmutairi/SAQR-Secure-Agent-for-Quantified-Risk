import pytest

from app.domain.entities import BehavioralSnapshot, CustomerProfileSnapshot, StructuralSnapshot, TrustSnapshot
from app.domain.ports import (
    BehavioralDnaClient,
    CustomerProfileProvider,
    GraphIntelligenceClient,
    TrustIntelligenceClient,
)
from app.policy.engine import RuleEvaluationEngine
from app.policy.registry_loader import YamlPolicyProvider
from app.policy.triggers import build_default_evaluators
from app.service import ComplianceEvaluationService


class FakeBehavioralClient(BehavioralDnaClient):
    def __init__(self, profile: BehavioralSnapshot | None) -> None:
        self._profile = profile

    async def get_profile(self, customer_id: str) -> BehavioralSnapshot | None:
        return self._profile


class FakeGraphClient(GraphIntelligenceClient):
    def __init__(self, output: StructuralSnapshot | None) -> None:
        self._output = output

    async def get_output(self, account_id: str) -> StructuralSnapshot | None:
        return self._output


class FakeTrustClient(TrustIntelligenceClient):
    def __init__(self, snapshot: TrustSnapshot | None) -> None:
        self._snapshot = snapshot

    async def evaluate_trust(self, transaction_id: str, customer_id: str, account_id: str) -> TrustSnapshot | None:
        return self._snapshot


class FakeCustomerProfileProvider(CustomerProfileProvider):
    def __init__(self, profile: CustomerProfileSnapshot | None = None) -> None:
        self._profile = profile

    async def get_profile(self, customer_id: str) -> CustomerProfileSnapshot | None:
        return self._profile


def _service(behavioral=None, structural=None, trust=None, customer_profile=None) -> ComplianceEvaluationService:
    policy_provider = YamlPolicyProvider("/Users/renad/saqrai/compliance_policies/registry")
    return ComplianceEvaluationService(
        behavioral_client=FakeBehavioralClient(behavioral),
        graph_client=FakeGraphClient(structural),
        trust_client=FakeTrustClient(trust),
        customer_profile_provider=FakeCustomerProfileProvider(customer_profile),
        policy_provider=policy_provider,
        rule_engine=RuleEvaluationEngine(build_default_evaluators()),
    )


@pytest.mark.asyncio
async def test_full_evaluation_with_all_upstreams_available(request_, behavioral, structural, trust):
    service = _service(behavioral, structural, trust)
    output = await service.evaluate(request_)

    assert output.transaction_id == "tx-1"
    assert output.customer_id == "cust-1"
    assert 0.0 <= output.compliance_score <= 1.0
    assert 0.0 <= output.compliance_confidence <= 1.0
    assert output.compliance_status in {"compliant", "requires_review", "non_compliant"}
    assert len(output.passed_rules) + len(output.violated_rules) + len(output.unevaluated_rules) >= 25


@pytest.mark.asyncio
async def test_all_upstreams_unavailable_still_returns_a_result(request_):
    service = _service()
    output = await service.evaluate(request_)

    assert output.compliance_confidence < 1.0
    assert len(output.unevaluated_rules) > 0
    # cdd_incomplete has an evaluator and both behavioral+structural are None -> a genuine violation
    assert "AML-CDD-007" in output.violated_rules or "AML-CDD-007" not in (
        output.passed_rules + output.violated_rules + output.unevaluated_rules
    )


@pytest.mark.asyncio
async def test_never_a_false_pass_when_data_unavailable(request_):
    """Core honesty guarantee: rules requiring data we don't have must never
    resolve to PASSED just because an upstream call failed."""
    service = _service()
    output = await service.evaluate(request_)
    assert "AML-CDD-007" not in output.passed_rules
    assert "SANC-002" not in output.passed_rules


@pytest.mark.asyncio
async def test_fully_degraded_trust_snapshot_does_not_fake_a_screening_pass(request_, zero_confidence_trust):
    """Reproduces a real bug found in end-to-end testing: Agent 3 always
    returns a non-null TrustSnapshot even with zero real evidence
    (confidence_level=0.0), which must not be mistaken for 'screening
    occurred' by SANC-002."""
    service = _service(trust=zero_confidence_trust)
    output = await service.evaluate(request_)
    assert "SANC-002" not in output.passed_rules
    assert "SANC-002" in output.unevaluated_rules


@pytest.mark.asyncio
async def test_unknown_account_realistic_degradation_never_falsely_passes(
    request_, zero_confidence_structural, zero_confidence_trust
):
    """Reproduces the exact production scenario found in end-to-end testing:
    for a genuinely unknown customer/account, Agent 1 returns None (real
    404), but Agent 2 and Agent 3 both return real, non-null, zero-valued
    objects (their designed graceful-degradation behavior) rather than None.
    Naive `is not None` checks on structural/trust would falsely PASS
    AML-CDD-007 and SANC-002 here - this is the honesty guarantee the whole
    UNEVALUATED/VIOLATED split exists to protect."""
    service = _service(behavioral=None, structural=zero_confidence_structural, trust=zero_confidence_trust)
    output = await service.evaluate(request_)

    assert "AML-CDD-007" in output.violated_rules
    assert "SANC-002" in output.unevaluated_rules
    assert "AML-CDD-007" not in output.passed_rules
    assert "SANC-002" not in output.passed_rules
    assert output.compliance_status == "non_compliant"
    assert output.compliance_score == 0.0


@pytest.mark.asyncio
async def test_output_never_leaks_upstream_internal_fields(request_, behavioral, structural, trust):
    service = _service(behavioral, structural, trust)
    output = await service.evaluate(request_)
    dumped = output.model_dump()
    assert "behavioral_dna_vector" not in dumped
    assert "graph_embedding" not in dumped
    assert "evidence_breakdown" not in dumped


@pytest.mark.asyncio
async def test_output_schema_matches_contract(request_, behavioral, structural, trust):
    service = _service(behavioral, structural, trust)
    output = await service.evaluate(request_)
    dumped = output.model_dump()
    expected_fields = {
        "transaction_id",
        "customer_id",
        "compliance_score",
        "compliance_status",
        "compliance_confidence",
        "aml_assessment",
        "kyc_assessment",
        "policy_assessment",
        "violated_rules",
        "passed_rules",
        "unevaluated_rules",
        "compliance_explanation",
        "generated_at",
        "schema_version",
    }
    assert expected_fields == set(dumped.keys())
