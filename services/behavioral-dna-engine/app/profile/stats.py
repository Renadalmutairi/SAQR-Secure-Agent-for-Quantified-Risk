"""Pure streaming-statistics math. No I/O, no dependencies on the rest of the app - easy to unit test exhaustively."""


def welford_update(count: int, mean: float, m2: float, new_value: float) -> tuple[int, float, float]:
    """One step of Welford's online algorithm for mean/variance. Never needs raw history."""
    count += 1
    delta = new_value - mean
    mean += delta / count
    delta2 = new_value - mean
    m2 += delta * delta2
    return count, mean, m2


def z_score(observed: float, mean: float, stddev: float) -> float:
    if stddev <= 1e-9:
        return 0.0
    return (observed - mean) / stddev


def deviation_level(abs_z: float) -> str:
    if abs_z >= 3.0:
        return "high"
    if abs_z >= 1.5:
        return "moderate"
    return "normal"
