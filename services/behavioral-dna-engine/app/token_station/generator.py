import secrets

_PREFIX = "SAQR-TX-"
_HEX_BYTES = 4  # 8 hex chars, ~4.3 billion combinations


def generate_token() -> str:
    """Cryptographically secure (stdlib `secrets`, not `random`), human-readable,
    deliberately not a plain UUID. Format: SAQR-TX-7F91D2A4."""
    return f"{_PREFIX}{secrets.token_hex(_HEX_BYTES).upper()}"
