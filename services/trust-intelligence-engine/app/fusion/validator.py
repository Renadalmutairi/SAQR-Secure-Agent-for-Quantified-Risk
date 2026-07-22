from app.domain.entities import Evidence


class EvidenceValidator:
    """Guards against malformed evidence reaching fusion, regardless of which
    upstream implementation produced it (HTTP today, Kafka/gRPC/DB-backed
    tomorrow - the fusion engine has no idea and shouldn't need to). Evidence
    marked available but missing required fields, or carrying out-of-range
    values, is demoted to unavailable rather than silently corrupting the
    fused trust score.
    """

    def validate(self, evidence: Evidence) -> Evidence:
        if not evidence.available:
            return evidence

        if evidence.score is None or evidence.confidence is None:
            return evidence.model_copy(
                update={"available": False, "detail": f"failed validation: missing score/confidence (was: {evidence.detail})"}
            )

        out_of_bounds = (
            not (0.0 <= evidence.score <= 1.0)
            or not (0.0 <= evidence.confidence <= 1.0)
            or (evidence.quality is not None and not (0.0 <= evidence.quality <= 1.0))
        )
        if out_of_bounds:
            return evidence.model_copy(
                update={
                    "available": False,
                    "detail": f"failed validation: score/confidence/quality out of [0,1] bounds (was: {evidence.detail})",
                }
            )

        return evidence
