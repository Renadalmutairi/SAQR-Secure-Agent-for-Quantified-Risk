"""Pure math helpers. Duplicated (not imported) from Agent 1/2's identical
saturating_growth - separate deployable services, same small pure function."""

import math


def saturating_growth(value: float, scale: float) -> float:
    """Grows toward 1 with diminishing returns. Used for history_depth: more
    transaction history is better, but doesn't need to be literally infinite."""
    if scale <= 0:
        return 1.0 if value > 0 else 0.0
    return 1.0 - math.exp(-value / scale)
