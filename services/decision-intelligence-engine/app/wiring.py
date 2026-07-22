from dataclasses import dataclass

import httpx

from app.config import Settings
from app.fusion.config import FusionWeights, RiskThresholds
from app.fusion.engine import RiskFusionEngine
from app.infra.http.behavioral_dna_client import HttpBehavioralDnaClient
from app.infra.http.compliance_client import HttpComplianceClient
from app.infra.http.graph_intelligence_client import HttpGraphIntelligenceClient
from app.infra.http.trust_intelligence_client import HttpTrustIntelligenceClient
from app.service import DecisionEvaluationService


@dataclass
class Container:
    settings: Settings
    http_client: httpx.AsyncClient
    evaluation_service: DecisionEvaluationService

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
    compliance_client = HttpComplianceClient(
        http_client, settings.compliance_base_url, settings.upstream_timeout_seconds
    )

    weights = FusionWeights(
        behavioral=settings.weight_behavioral,
        graph=settings.weight_graph,
        trust=settings.weight_trust,
        compliance=settings.weight_compliance,
    )
    thresholds = RiskThresholds(
        low=settings.risk_threshold_low,
        medium=settings.risk_threshold_medium,
        high=settings.risk_threshold_high,
    )

    evaluation_service = DecisionEvaluationService(
        behavioral_client=behavioral_client,
        graph_client=graph_client,
        trust_client=trust_client,
        compliance_client=compliance_client,
        fusion_engine=RiskFusionEngine(weights),
        risk_thresholds=thresholds,
    )

    return Container(settings=settings, http_client=http_client, evaluation_service=evaluation_service)
