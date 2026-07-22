import uuid
from datetime import UTC, datetime

from app.domain.entities import (
    AccountBehavioralContext,
    BehavioralDnaProfile,
    ChangedFeature,
    DnaVectorEntry,
    FeatureValue,
)
from app.profile.hashing import canonical_hash
from app.profile.stats import welford_update


def _next_dna_vector(
    prior_entries: dict[str, DnaVectorEntry], observed_features: list[FeatureValue]
) -> list[DnaVectorEntry]:
    new_entries: list[DnaVectorEntry] = []
    seen: set[str] = set()
    for fv in observed_features:
        seen.add(fv.name)
        prior = prior_entries.get(fv.name)
        if prior is None:
            count, mean, m2 = welford_update(0, 0.0, 0.0, fv.value)
        else:
            count, mean, m2 = welford_update(prior.count, prior.mean, prior.m2, fv.value)
        new_entries.append(DnaVectorEntry(feature=fv.name, group=fv.group, count=count, mean=mean, m2=m2))
    # Carry forward features not present on this transaction (e.g. a disabled group).
    for name, entry in prior_entries.items():
        if name not in seen:
            new_entries.append(entry)
    return new_entries


def build_next_version(
    customer_id: str,
    previous: BehavioralDnaProfile | None,
    observed_features: list[FeatureValue],
    receiver_account_id: str,
    changed_features: list[ChangedFeature],
    behavioral_risk_score: float,
    confidence: float,
    similarity_score: float,
    explanation: str,
    source_tx_id: str | None = None,
) -> BehavioralDnaProfile:
    """Build the NEXT version of a customer's Behavioral DNA. Never mutates `previous` -
    the caller is responsible for persisting this as a new row and marking the old one
    superseded (is_current=False), never overwriting or deleting it.
    """
    prior_entries = {e.feature: e for e in previous.dna_vector} if previous else {}
    prior_beneficiaries = dict(previous.trusted_beneficiaries) if previous else {}

    new_entries = _next_dna_vector(prior_entries, observed_features)
    prior_beneficiaries[receiver_account_id] = prior_beneficiaries.get(receiver_account_id, 0) + 1

    version = (previous.version + 1) if previous else 1
    history_depth = (previous.history_depth + 1) if previous else 1
    now = datetime.now(UTC)

    payload = {
        "customer_id": customer_id,
        "version": version,
        "dna_vector": [e.model_dump() for e in new_entries],
        "trusted_beneficiaries": prior_beneficiaries,
        "history_depth": history_depth,
        "behavioral_risk_score": behavioral_risk_score,
        "confidence_score": confidence,
        "similarity_score": similarity_score,
        "changed_features": [c.model_dump() for c in changed_features],
        "explanation": explanation,
        "valid_from": now.isoformat(),
    }
    prev_hash = previous.content_hash if previous else None
    content_hash = canonical_hash(payload, prev_hash)

    return BehavioralDnaProfile(
        profile_id=str(uuid.uuid4()),
        customer_id=customer_id,
        version=version,
        dna_vector=new_entries,
        trusted_beneficiaries=prior_beneficiaries,
        history_depth=history_depth,
        source_tx_id=source_tx_id,
        behavioral_risk_score=behavioral_risk_score,
        confidence_score=confidence,
        similarity_score=similarity_score,
        changed_features=changed_features,
        explanation=explanation,
        prev_version_hash=prev_hash,
        content_hash=content_hash,
        is_current=True,
        valid_from=now,
        valid_to=None,
    )


def build_next_account_context(
    account_id: str,
    customer_id: str,
    previous: AccountBehavioralContext | None,
    observed_features: list[FeatureValue],
    source_tx_id: str | None = None,
) -> AccountBehavioralContext:
    """Account-level counterpart to build_next_version. Lighter weight (no risk/
    confidence/explanation - that's customer-level output for downstream agents),
    but versioned the same way: append-only, never overwritten.
    """
    prior_entries = {e.feature: e for e in previous.dna_vector} if previous else {}
    new_entries = _next_dna_vector(prior_entries, observed_features)

    version = (previous.version + 1) if previous else 1
    history_depth = (previous.history_depth + 1) if previous else 1
    now = datetime.now(UTC)

    return AccountBehavioralContext(
        context_id=str(uuid.uuid4()),
        account_id=account_id,
        customer_id=customer_id,
        version=version,
        dna_vector=new_entries,
        history_depth=history_depth,
        source_tx_id=source_tx_id,
        is_current=True,
        valid_from=now,
        valid_to=None,
    )
