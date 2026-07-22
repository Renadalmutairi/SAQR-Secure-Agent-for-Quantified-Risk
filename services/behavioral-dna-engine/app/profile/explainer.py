from app.domain.entities import ChangedFeature


def explain(changed_features: list[ChangedFeature], confidence: float) -> str:
    """Plain-language diff of what moved. Not the SHAP/LIME Explainability Engine
    (a later agent) - that explains model decisions. This explains behavioral deltas.
    """
    if confidence < 0.3:
        return "Insufficient transaction history to reliably assess behavioral deviation yet."
    if not changed_features:
        return "Transaction is consistent with this customer's established behavioral pattern."

    parts = []
    for cf in sorted(changed_features, key=lambda c: abs(c.z_score), reverse=True):
        direction = "higher" if cf.z_score > 0 else "lower"
        parts.append(
            f"{cf.feature} was {direction} than usual "
            f"(observed {cf.observed:.2f} vs typical {cf.baseline_mean:.2f} +/- {cf.baseline_stddev:.2f}, "
            f"{cf.deviation_level} deviation)"
        )
    return "Behavioral deviation detected: " + "; ".join(parts) + "."
