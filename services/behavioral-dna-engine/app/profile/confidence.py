def confidence_score(history_depth: int, min_history_for_full_confidence: int) -> float:
    """Scores are meaningless without enough history - 9 transactions and 761
    transactions cannot produce equally trustworthy baselines (observed range
    in the current dataset). Confidence ramps linearly to 1.0 at the configured
    minimum and never claims full confidence before that.
    """
    if min_history_for_full_confidence <= 0:
        return 1.0
    return min(history_depth / min_history_for_full_confidence, 1.0)
