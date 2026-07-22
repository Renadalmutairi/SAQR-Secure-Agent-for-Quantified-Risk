import orjson
from redis.asyncio import Redis

from app.domain.entities import BehavioralDnaProfile
from app.domain.ports import Cache

_KEY_PREFIX = "saqr:behavioral-dna:current:"
_TTL_SECONDS = 24 * 60 * 60


class RedisCache(Cache):
    """Hot cache of the CURRENT profile only, keyed by customer_id. Postgres remains
    the source of truth; a cache miss or Redis outage just falls back to Postgres,
    it never causes data loss.
    """

    def __init__(self, client: Redis) -> None:
        self._client = client

    async def get_current_profile(self, customer_id: str) -> BehavioralDnaProfile | None:
        raw = await self._client.get(_KEY_PREFIX + customer_id)
        if raw is None:
            return None
        return BehavioralDnaProfile.model_validate(orjson.loads(raw))

    async def set_current_profile(self, profile: BehavioralDnaProfile) -> None:
        payload = orjson.dumps(profile.model_dump(mode="json"))
        await self._client.set(_KEY_PREFIX + profile.customer_id, payload, ex=_TTL_SECONDS)
