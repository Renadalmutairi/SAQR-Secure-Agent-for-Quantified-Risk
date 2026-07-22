from dataclasses import dataclass

import httpx

from app.config import Settings
from app.domain.ports import EvidenceProvider
from app.fusion.engine import EvidenceFusionEngine
from app.fusion.service import TrustEvaluationService
from app.infra.http.behavioral_dna_client import HttpBehavioralDnaClient
from app.infra.http.graph_intelligence_client import HttpGraphIntelligenceClient
from app.providers.behavioral_dna_provider import BehavioralDnaEvidenceProvider
from app.providers.device_trust_provider import DeviceTrustEvidenceProvider
from app.providers.geographic_trust_provider import GeographicTrustEvidenceProvider
from app.providers.historical_trust_provider import FallbackHistoricalSignalSource, HistoricalTrustEvidenceProvider
from app.providers.relationship_trust_provider import RelationshipTrustEvidenceProvider


@dataclass
class Container:
    settings: Settings
    http_client: httpx.AsyncClient
    evaluation_service: TrustEvaluationService

    async def shutdown(self) -> None:
        await self.http_client.aclose()


def build_providers(settings: Settings) -> list[EvidenceProvider]:
    return [
        BehavioralDnaEvidenceProvider(),
        DeviceTrustEvidenceProvider(),
        GeographicTrustEvidenceProvider(),
        RelationshipTrustEvidenceProvider(),
        # Explicit signal_source (rather than relying on the provider's default)
        # so swapping in a richer source later is a one-line change here, not
        # a hunt through the provider's internals.
        HistoricalTrustEvidenceProvider(
            signal_source=FallbackHistoricalSignalSource(), history_depth_scale=settings.history_depth_scale
        ),
    ]


async def build_container(settings: Settings) -> Container:
    http_client = httpx.AsyncClient()

    behavioral_client = HttpBehavioralDnaClient(
        http_client, settings.behavioral_dna_base_url, settings.upstream_timeout_seconds
    )
    graph_client = HttpGraphIntelligenceClient(
        http_client, settings.graph_intelligence_base_url, settings.upstream_timeout_seconds
    )

    evaluation_service = TrustEvaluationService(
        behavioral_client=behavioral_client,
        graph_client=graph_client,
        providers=build_providers(settings),
        fusion_engine=EvidenceFusionEngine(),
    )

    return Container(settings=settings, http_client=http_client, evaluation_service=evaluation_service)
