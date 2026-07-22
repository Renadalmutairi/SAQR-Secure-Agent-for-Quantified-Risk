from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_container
from app.domain.entities import EdgeDerivedMetrics, GraphIntelligenceOutput, StructuralAnomaly, StructuralFeatures
from app.graph.cold_path import ColdPathRunSummary
from app.wiring import Container

router = APIRouter(tags=["graph"])


@router.get("/accounts/{account_id}/structural-features", response_model=StructuralFeatures)
async def get_structural_features(
    account_id: str, hop: int = 2, container: Container = Depends(get_container)
) -> StructuralFeatures:
    return await container.graph_store.get_local_structural_features(account_id, hop=hop)


@router.get(
    "/accounts/{sender_account_id}/relationships/{receiver_account_id}/metrics",
    response_model=EdgeDerivedMetrics,
)
async def get_relationship_metrics(
    sender_account_id: str, receiver_account_id: str, container: Container = Depends(get_container)
) -> EdgeDerivedMetrics:
    """Structural Trust Score and the other derived relationship metrics -
    computed at read time from stored edge state, never persisted (see
    graph/trust_score.py). Not a fraud score - a measure of how established and
    trusted this relationship is in the graph.
    """
    metrics = await container.graph_store.get_edge_derived_metrics(sender_account_id, receiver_account_id)
    if metrics is None:
        raise HTTPException(status_code=404, detail="No relationship exists between these two accounts yet")
    return metrics


@router.get("/accounts/{account_id}/output", response_model=GraphIntelligenceOutput)
async def get_output(account_id: str, container: Container = Depends(get_container)) -> GraphIntelligenceOutput:
    return await container.graph_store.get_output_for_entity(account_id, entity_type="Account")


@router.get("/anomalies", response_model=list[StructuralAnomaly])
async def get_anomalies(container: Container = Depends(get_container)) -> list[StructuralAnomaly]:
    return await container.graph_store.detect_structural_anomalies()


@router.post("/cold-path/run", response_model=ColdPathRunSummary)
async def trigger_cold_path(container: Container = Depends(get_container)) -> ColdPathRunSummary:
    """Manual trigger, mainly for demos/ops - the scheduler already runs this
    periodically in the background."""
    return await container.cold_path.run_once()
