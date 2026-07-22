from app.domain.entities import AccountBehavioralContext, BehavioralDnaProfile
from app.domain.ports import ProfileRepository
from app.profile.hashing import canonical_hash


class InMemoryProfileRepository(ProfileRepository):
    """Reference implementation used by tests and local dev without Postgres.

    Enforces the same append-only contract as the real Postgres adapter: history
    lists are only ever appended to, never mutated or truncated.
    """

    def __init__(self) -> None:
        self._history: dict[str, list[BehavioralDnaProfile]] = {}
        self._account_history: dict[str, list[AccountBehavioralContext]] = {}

    async def get_current(self, customer_id: str) -> BehavioralDnaProfile | None:
        versions = self._history.get(customer_id)
        return versions[-1] if versions else None

    async def get_history(self, customer_id: str, limit: int = 100) -> list[BehavioralDnaProfile]:
        versions = self._history.get(customer_id, [])
        return list(reversed(versions[-limit:]))

    async def append_version(self, profile: BehavioralDnaProfile) -> None:
        versions = self._history.setdefault(profile.customer_id, [])
        if versions:
            versions[-1] = versions[-1].model_copy(update={"is_current": False, "valid_to": profile.valid_from})
        versions.append(profile)

    async def get_current_account_context(self, account_id: str) -> AccountBehavioralContext | None:
        versions = self._account_history.get(account_id)
        return versions[-1] if versions else None

    async def append_account_context_version(self, context: AccountBehavioralContext) -> None:
        versions = self._account_history.setdefault(context.account_id, [])
        if versions:
            versions[-1] = versions[-1].model_copy(update={"is_current": False, "valid_to": context.valid_from})
        versions.append(context)

    async def verify_chain_integrity(self, customer_id: str) -> bool:
        versions = self._history.get(customer_id, [])
        prev_hash: str | None = None
        for version in versions:
            payload = {
                "customer_id": version.customer_id,
                "version": version.version,
                "dna_vector": [e.model_dump() for e in version.dna_vector],
                "trusted_beneficiaries": version.trusted_beneficiaries,
                "history_depth": version.history_depth,
                "behavioral_risk_score": version.behavioral_risk_score,
                "confidence_score": version.confidence_score,
                "similarity_score": version.similarity_score,
                "changed_features": [c.model_dump() for c in version.changed_features],
                "explanation": version.explanation,
                "valid_from": version.valid_from.isoformat(),
            }
            expected = canonical_hash(payload, prev_hash)
            if expected != version.content_hash or version.prev_version_hash != prev_hash:
                return False
            prev_hash = version.content_hash
        return True
