from datetime import UTC, datetime

from app.config import Settings
from app.domain.entities import DnaOutput, TransactionEvent
from app.domain.ports import Cache, CustomerAccountRepository, EventPublisher, ProfileRepository, TransactionSource
from app.features.base import FeatureContext, FeatureRegistry
from app.profile.comparator import compare
from app.profile.confidence import confidence_score
from app.profile.explainer import explain
from app.profile.updater import build_next_account_context, build_next_version


class BehavioralDnaService:
    """Orchestrates a single transaction through the full Agent 1 pipeline.

    This is the ONLY entry point that updates a Behavioral DNA profile - used
    identically for real-time scoring and for historical backfill, so the feature
    engineering and scoring logic can never drift between the two paths.
    """

    def __init__(
        self,
        registry: FeatureRegistry,
        profiles: ProfileRepository,
        customer_accounts: CustomerAccountRepository,
        cache: Cache,
        publisher: EventPublisher,
        settings: Settings,
    ) -> None:
        self._registry = registry
        self._profiles = profiles
        self._customer_accounts = customer_accounts
        self._cache = cache
        self._publisher = publisher
        self._settings = settings

    async def score_transaction(self, event: TransactionEvent) -> DnaOutput:
        customer = await self._customer_accounts.get_or_create_customer_for_account(event.sender_account_id)

        current = await self._cache.get_current_profile(customer.customer_id)
        if current is None:
            current = await self._profiles.get_current(customer.customer_id)

        context = FeatureContext(
            account_id=event.sender_account_id,
            trusted_beneficiaries=current.trusted_beneficiaries if current else {},
            last_tx_step=None,
            tx_count_so_far=current.history_depth if current else 0,
        )
        observed = self._registry.extract_all(event, context)

        baseline = {e.feature: e for e in current.dna_vector} if current else {}
        deviation = compare(observed, baseline)

        history_depth = (current.history_depth + 1) if current else 1
        confidence = confidence_score(history_depth, self._settings.min_history_for_full_confidence)
        explanation = explain(deviation.changed_features, confidence)

        next_version = build_next_version(
            customer_id=customer.customer_id,
            previous=current,
            observed_features=observed,
            receiver_account_id=event.receiver_account_id,
            changed_features=deviation.changed_features,
            behavioral_risk_score=deviation.behavioral_risk_score,
            confidence=confidence,
            similarity_score=deviation.similarity_score,
            explanation=explanation,
            source_tx_id=event.tx_id,
        )
        await self._profiles.append_version(next_version)
        await self._cache.set_current_profile(next_version)

        account_context = await self._profiles.get_current_account_context(event.sender_account_id)
        next_account_context = build_next_account_context(
            account_id=event.sender_account_id,
            customer_id=customer.customer_id,
            previous=account_context,
            observed_features=observed,
            source_tx_id=event.tx_id,
        )
        await self._profiles.append_account_context_version(next_account_context)

        output = DnaOutput(
            transaction_id=event.tx_id,
            customer_id=customer.customer_id,
            account_id=event.sender_account_id,
            receiver_account_id=event.receiver_account_id,
            profile_version=next_version.version,
            behavioral_risk_score=next_version.behavioral_risk_score or 0.0,
            confidence_score=next_version.confidence_score,
            similarity_score=next_version.similarity_score or 0.0,
            behavioral_dna_vector=next_version.dna_vector,
            changed_features=next_version.changed_features,
            explanation=next_version.explanation or "",
            occurred_at=event.occurred_at,
            generated_at=datetime.now(UTC),
        )
        await self._publisher.publish_dna_output(output)
        return output

    async def get_profile(self, customer_id: str):
        return await self._profiles.get_current(customer_id)

    async def get_profile_history(self, customer_id: str, limit: int = 100):
        return await self._profiles.get_history(customer_id, limit=limit)

    async def get_account_context(self, account_id: str):
        return await self._profiles.get_current_account_context(account_id)

    async def verify_audit_trail(self, customer_id: str) -> bool:
        return await self._profiles.verify_chain_integrity(customer_id)

    async def backfill_from_source(self, source: TransactionSource) -> int:
        count = 0
        async for event in source.stream_historical():
            await self.score_transaction(event)
            count += 1
        return count
