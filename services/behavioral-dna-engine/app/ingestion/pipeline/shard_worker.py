from datetime import UTC, datetime

from app.config import Settings
from app.domain.entities import (
    AccountBehavioralContext,
    BehavioralDnaProfile,
    DnaOutput,
    TransactionEvent,
)
from app.features.base import FeatureContext, FeatureRegistry
from app.profile.comparator import compare
from app.profile.confidence import confidence_score
from app.profile.explainer import explain
from app.profile.updater import build_next_account_context, build_next_version


class ShardWorker:
    """Owns a disjoint subset of customers (assigned by hashing resolved
    customer_id, never raw account_id - a customer with multiple accounts must
    always land on the same shard, or two shards could race to update the same
    customer's Welford state and corrupt it).

    Pure in-memory: no DB/Kafka I/O happens here. The coordinator hydrates each
    shard's newly-touched customers/accounts (concurrently, across all shards -
    that's where real async concurrency helps, since it's I/O-bound), then calls
    `process_staged()` (fast, sequential, no I/O) and writes every shard's output
    in ONE transaction per generation - see coordinator.py for why a single shared
    transaction, not one per shard, is required for correctness here.
    """

    def __init__(self, shard_id: int, registry: FeatureRegistry, settings: Settings) -> None:
        self.shard_id = shard_id
        self._registry = registry
        self._settings = settings

        self._profile_cache: dict[str, BehavioralDnaProfile | None] = {}
        self._context_cache: dict[str, AccountBehavioralContext | None] = {}
        self._hydrated_customers: set[str] = set()
        self._hydrated_accounts: set[str] = set()
        self._staged: list[tuple[TransactionEvent, str]] = []

        self.rows_processed_total = 0

    def stage(self, event: TransactionEvent, customer_id: str) -> None:
        self._staged.append((event, customer_id))

    @property
    def staged_count(self) -> int:
        return len(self._staged)

    def pending_new_customer_ids(self) -> set[str]:
        return {cid for _, cid in self._staged if cid not in self._hydrated_customers}

    def pending_new_account_ids(self) -> set[str]:
        return {
            event.sender_account_id
            for event, _ in self._staged
            if event.sender_account_id not in self._hydrated_accounts
        }

    def hydrate_customer(self, customer_id: str, profile: BehavioralDnaProfile | None) -> None:
        self._profile_cache[customer_id] = profile
        self._hydrated_customers.add(customer_id)

    def hydrate_account(self, account_id: str, context: AccountBehavioralContext | None) -> None:
        self._context_cache[account_id] = context
        self._hydrated_accounts.add(account_id)

    def _process_one(self, event: TransactionEvent, customer_id: str) -> DnaOutput:
        """Identical math to BehavioralDnaService.score_transaction, operating on
        the shard's local cache instead of awaiting I/O per call."""
        current = self._profile_cache.get(customer_id)
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
            customer_id=customer_id,
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
        self._profile_cache[customer_id] = next_version

        account_context = self._context_cache.get(event.sender_account_id)
        next_context = build_next_account_context(
            account_id=event.sender_account_id,
            customer_id=customer_id,
            previous=account_context,
            observed_features=observed,
            source_tx_id=event.tx_id,
        )
        self._context_cache[event.sender_account_id] = next_context

        return DnaOutput(
            transaction_id=event.tx_id,
            customer_id=customer_id,
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

    def process_staged(
        self,
    ) -> tuple[list[DnaOutput], list[BehavioralDnaProfile], list[AccountBehavioralContext]]:
        outputs: list[DnaOutput] = []
        profile_versions: list[BehavioralDnaProfile] = []
        context_versions: list[AccountBehavioralContext] = []

        for event, customer_id in self._staged:
            output = self._process_one(event, customer_id)
            outputs.append(output)
            profile_versions.append(self._profile_cache[customer_id])
            context_versions.append(self._context_cache[event.sender_account_id])

        self.rows_processed_total += len(self._staged)
        self._staged = []
        return outputs, profile_versions, context_versions
