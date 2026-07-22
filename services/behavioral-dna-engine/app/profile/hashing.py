"""Tamper-evident hash chain for the versioned profile audit trail.

Each version's content_hash is a function of its own payload AND the previous
version's content_hash. Altering any historical version breaks every hash after
it, so `verify_chain_integrity` can detect tampering - this is what makes the
version history usable as evidence in a regulatory investigation, not just a log.
"""

import hashlib

import orjson


def canonical_hash(payload: dict, prev_hash: str | None) -> str:
    body = {"prev_hash": prev_hash, "payload": payload}
    encoded = orjson.dumps(body, option=orjson.OPT_SORT_KEYS)
    return hashlib.sha256(encoded).hexdigest()
