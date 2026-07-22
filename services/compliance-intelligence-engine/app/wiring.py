from dataclasses import dataclass

import httpx

from app.config import Settings
from app.infra.customer_profile.mock_provider import MockCustomerProfileProvider
from app.infra.http.behavioral_dna_client import HttpBehavioralDnaClient
from app.infra.http.graph_intelligence_client import HttpGraphIntelligenceClient
from app.infra.http.trust_intelligence_client import HttpTrustIntelligenceClient
from app.policy.engine import RuleEvaluationEngine
from app.policy.registry_loader import YamlPolicyProvider
from app.policy.triggers import build_default_evaluators
from app.service import ComplianceEvaluationService


@dataclass
class Container:
    settings: Settings
    http_client: httpx.AsyncClient
    evaluation_service: ComplianceEvaluationService
    policy_provider: YamlPolicyProvider

    async def shutdown(self) -> None:
        await self.http_client.aclose()


async def build_container(settings: Settings) -> Container:
    http_client = httpx.AsyncClient()

    behavioral_client = HttpBehavioralDnaClient(
        http_client, settings.behavioral_dna_base_url, settings.upstream_timeout_seconds
    )
    graph_client = HttpGraphIntelligenceClient(
        http_client, settings.graph_intelligence_base_url, settings.upstream_timeout_seconds
    )
    trust_client = HttpTrustIntelligenceClient(
        http_client, settings.trust_intelligence_base_url, settings.upstream_timeout_seconds
    )
    customer_profile_provider = MockCustomerProfileProvider()

    policy_provider = YamlPolicyProvider(settings.policy_registry_dir)
    # Force the load now (not lazily on first request) so a broken registry
    # fails fast at startup rather than on a customer's first transaction.
    policy_provider.get_rules()

    rule_engine = RuleEvaluationEngine(build_default_evaluators())

    evaluation_service = ComplianceEvaluationService(
        behavioral_client=behavioral_client,
        graph_client=graph_client,
        trust_client=trust_client,
        customer_profile_provider=customer_profile_provider,
        policy_provider=policy_provider,
        rule_engine=rule_engine,
    )

    return Container(
        settings=settings,
        http_client=http_client,
        evaluation_service=evaluation_service,
        policy_provider=policy_provider,
    )
