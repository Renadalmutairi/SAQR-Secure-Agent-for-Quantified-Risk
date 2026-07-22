from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.entities import AccountBehavioralContext, BehavioralDnaProfile, ChangedFeature, DnaVectorEntry
from app.domain.ports import ProfileRepository
from app.infra.db.models import AccountBehavioralContextModel, BehavioralDnaProfileModel
from app.profile.hashing import canonical_hash


def _profile_to_domain(row: BehavioralDnaProfileModel) -> BehavioralDnaProfile:
    return BehavioralDnaProfile(
        profile_id=row.profile_id,
        customer_id=row.customer_id,
        version=row.version,
        dna_vector=[DnaVectorEntry(**e) for e in row.dna_vector],
        trusted_beneficiaries=row.trusted_beneficiaries,
        history_depth=row.history_depth,
        source_tx_id=row.source_tx_id,
        behavioral_risk_score=row.behavioral_risk_score,
        confidence_score=row.confidence_score,
        similarity_score=row.similarity_score,
        changed_features=[ChangedFeature(**c) for c in row.changed_features],
        explanation=row.explanation,
        prev_version_hash=row.prev_version_hash,
        content_hash=row.content_hash,
        is_current=row.is_current,
        valid_from=row.valid_from,
        valid_to=row.valid_to,
        schema_version=row.schema_version,
    )


def _context_to_domain(row: AccountBehavioralContextModel) -> AccountBehavioralContext:
    return AccountBehavioralContext(
        context_id=row.context_id,
        account_id=row.account_id,
        customer_id=row.customer_id,
        version=row.version,
        dna_vector=[DnaVectorEntry(**e) for e in row.dna_vector],
        history_depth=row.history_depth,
        source_tx_id=row.source_tx_id,
        is_current=row.is_current,
        valid_from=row.valid_from,
        valid_to=row.valid_to,
    )


class PostgresProfileRepository(ProfileRepository):
    """System of record for versioned Behavioral DNA. Every write is an INSERT of a
    new row; the only UPDATE ever issued is flipping the previous current row's
    is_current/valid_to when it is superseded - its behavioral content is untouched.
    """

    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._session_factory = session_factory

    @property
    def session_factory(self) -> async_sessionmaker:
        """Exposed so bulk pipeline callers can open one session/transaction spanning
        a batch's profile writes, account-context writes, and checkpoint advance -
        all committing atomically or not at all.
        """
        return self._session_factory

    async def get_current(self, customer_id: str) -> BehavioralDnaProfile | None:
        async with self._session_factory() as session:
            stmt = select(BehavioralDnaProfileModel).where(
                BehavioralDnaProfileModel.customer_id == customer_id,
                BehavioralDnaProfileModel.is_current.is_(True),
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _profile_to_domain(row) if row else None

    async def get_history(self, customer_id: str, limit: int = 100) -> list[BehavioralDnaProfile]:
        async with self._session_factory() as session:
            stmt = (
                select(BehavioralDnaProfileModel)
                .where(BehavioralDnaProfileModel.customer_id == customer_id)
                .order_by(BehavioralDnaProfileModel.version.desc())
                .limit(limit)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_profile_to_domain(row) for row in rows]

    async def append_version(self, profile: BehavioralDnaProfile) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                await session.execute(
                    update(BehavioralDnaProfileModel)
                    .where(
                        BehavioralDnaProfileModel.customer_id == profile.customer_id,
                        BehavioralDnaProfileModel.is_current.is_(True),
                    )
                    .values(is_current=False, valid_to=profile.valid_from)
                )
                session.add(
                    BehavioralDnaProfileModel(
                        profile_id=profile.profile_id,
                        customer_id=profile.customer_id,
                        version=profile.version,
                        dna_vector=[e.model_dump() for e in profile.dna_vector],
                        trusted_beneficiaries=profile.trusted_beneficiaries,
                        history_depth=profile.history_depth,
                        source_tx_id=profile.source_tx_id,
                        behavioral_risk_score=profile.behavioral_risk_score,
                        confidence_score=profile.confidence_score,
                        similarity_score=profile.similarity_score,
                        changed_features=[c.model_dump() for c in profile.changed_features],
                        explanation=profile.explanation,
                        prev_version_hash=profile.prev_version_hash,
                        content_hash=profile.content_hash,
                        is_current=True,
                        valid_from=profile.valid_from,
                        valid_to=None,
                        schema_version=profile.schema_version,
                    )
                )

    async def bulk_append_versions(self, session: AsyncSession, profiles: list[BehavioralDnaProfile]) -> None:
        """Batched counterpart to append_version: ONE flip-UPDATE covering every
        distinct customer in the batch, then ONE bulk INSERT for every version -
        instead of an UPDATE+INSERT round trip per transaction. Caller owns the
        session/transaction (the bulk pipeline commits this together with account
        context writes and the checkpoint advance).
        """
        if not profiles:
            return

        customer_ids = list({p.customer_id for p in profiles})
        await session.execute(
            update(BehavioralDnaProfileModel)
            .where(
                BehavioralDnaProfileModel.customer_id.in_(customer_ids),
                BehavioralDnaProfileModel.is_current.is_(True),
            )
            .values(is_current=False, valid_to=profiles[0].valid_from)
        )

        # Only the LAST version per customer in this batch stays current.
        last_version_per_customer = {}
        for p in profiles:
            if p.customer_id not in last_version_per_customer or p.version > last_version_per_customer[p.customer_id]:
                last_version_per_customer[p.customer_id] = p.version

        rows = [
            {
                "profile_id": p.profile_id,
                "customer_id": p.customer_id,
                "version": p.version,
                "dna_vector": [e.model_dump() for e in p.dna_vector],
                "trusted_beneficiaries": p.trusted_beneficiaries,
                "history_depth": p.history_depth,
                "source_tx_id": p.source_tx_id,
                "behavioral_risk_score": p.behavioral_risk_score,
                "confidence_score": p.confidence_score,
                "similarity_score": p.similarity_score,
                "changed_features": [c.model_dump() for c in p.changed_features],
                "explanation": p.explanation,
                "prev_version_hash": p.prev_version_hash,
                "content_hash": p.content_hash,
                "is_current": p.version == last_version_per_customer[p.customer_id],
                "valid_from": p.valid_from,
                "valid_to": None if p.version == last_version_per_customer[p.customer_id] else p.valid_from,
                "schema_version": p.schema_version,
            }
            for p in profiles
        ]
        await session.execute(BehavioralDnaProfileModel.__table__.insert(), rows)

    async def bulk_append_account_contexts(self, session: AsyncSession, contexts: list[AccountBehavioralContext]) -> None:
        if not contexts:
            return

        account_ids = list({c.account_id for c in contexts})
        await session.execute(
            update(AccountBehavioralContextModel)
            .where(
                AccountBehavioralContextModel.account_id.in_(account_ids),
                AccountBehavioralContextModel.is_current.is_(True),
            )
            .values(is_current=False, valid_to=contexts[0].valid_from)
        )

        last_version_per_account = {}
        for c in contexts:
            if c.account_id not in last_version_per_account or c.version > last_version_per_account[c.account_id]:
                last_version_per_account[c.account_id] = c.version

        rows = [
            {
                "context_id": c.context_id,
                "account_id": c.account_id,
                "customer_id": c.customer_id,
                "version": c.version,
                "dna_vector": [e.model_dump() for e in c.dna_vector],
                "history_depth": c.history_depth,
                "source_tx_id": c.source_tx_id,
                "is_current": c.version == last_version_per_account[c.account_id],
                "valid_from": c.valid_from,
                "valid_to": None if c.version == last_version_per_account[c.account_id] else c.valid_from,
            }
            for c in contexts
        ]
        await session.execute(AccountBehavioralContextModel.__table__.insert(), rows)

    async def get_current_account_context(self, account_id: str) -> AccountBehavioralContext | None:
        async with self._session_factory() as session:
            stmt = select(AccountBehavioralContextModel).where(
                AccountBehavioralContextModel.account_id == account_id,
                AccountBehavioralContextModel.is_current.is_(True),
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _context_to_domain(row) if row else None

    async def append_account_context_version(self, context: AccountBehavioralContext) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                await session.execute(
                    update(AccountBehavioralContextModel)
                    .where(
                        AccountBehavioralContextModel.account_id == context.account_id,
                        AccountBehavioralContextModel.is_current.is_(True),
                    )
                    .values(is_current=False, valid_to=context.valid_from)
                )
                session.add(
                    AccountBehavioralContextModel(
                        context_id=context.context_id,
                        account_id=context.account_id,
                        customer_id=context.customer_id,
                        version=context.version,
                        dna_vector=[e.model_dump() for e in context.dna_vector],
                        history_depth=context.history_depth,
                        source_tx_id=context.source_tx_id,
                        is_current=True,
                        valid_from=context.valid_from,
                        valid_to=None,
                    )
                )

    async def verify_chain_integrity(self, customer_id: str) -> bool:
        history = list(reversed(await self.get_history(customer_id, limit=10_000)))
        prev_hash: str | None = None
        for version in history:
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
