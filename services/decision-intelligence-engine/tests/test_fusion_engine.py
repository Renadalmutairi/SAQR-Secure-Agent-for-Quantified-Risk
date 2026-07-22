from app.domain.ports import EvidenceContext
from app.fusion.engine import RiskFusionEngine


def _context(request_, behavioral=None, graph=None, trust=None, compliance=None):
    return EvidenceContext(request=request_, behavioral=behavioral, graph=graph, trust=trust, compliance=compliance)


def test_all_low_risk_evidence_yields_low_overall_score(
    request_, low_risk_behavioral, low_risk_graph, high_trust, clean_compliance
):
    engine = RiskFusionEngine()
    result = engine.fuse(_context(request_, low_risk_behavioral, low_risk_graph, high_trust, clean_compliance))
    assert result.overall_risk_score < 0.25
    assert result.decision_confidence > 0.9


def test_all_high_risk_evidence_yields_high_overall_score(
    request_, high_risk_behavioral, high_risk_graph, low_trust, blocking_compliance
):
    engine = RiskFusionEngine()
    result = engine.fuse(_context(request_, high_risk_behavioral, high_risk_graph, low_trust, blocking_compliance))
    assert result.overall_risk_score > 0.7


def test_no_evidence_available_yields_zero_score_and_zero_confidence(request_):
    engine = RiskFusionEngine()
    result = engine.fuse(_context(request_))
    assert result.overall_risk_score == 0.0
    assert result.decision_confidence == 0.0
    assert all(not c.available for c in result.contributions)


def test_missing_behavioral_risk_score_treated_as_unavailable(request_):
    """Agent 1 can return a profile with behavioral_risk_score=None (not
    enough history yet) - that must be excluded from fusion, not treated as
    zero risk."""
    from app.domain.entities import BehavioralSnapshot

    incomplete = BehavioralSnapshot(customer_id="cust-1", behavioral_risk_score=None, confidence_score=0.1, history_depth=1)
    engine = RiskFusionEngine()
    result = engine.fuse(_context(request_, behavioral=incomplete))
    behavioral_contribution = next(c for c in result.contributions if c.source.value == "behavioral")
    assert behavioral_contribution.available is False


def test_zero_confidence_graph_excluded_not_treated_as_low_risk(request_, zero_confidence_graph):
    """Regression guard mirroring the Agent 4 bug: Agent 2 returns a real,
    non-null, zero-valued object for an unknown account - that must be
    excluded from fusion, not read as 'confirmed low risk'."""
    engine = RiskFusionEngine()
    result = engine.fuse(_context(request_, graph=zero_confidence_graph))
    graph_contribution = next(c for c in result.contributions if c.source.value == "graph")
    assert graph_contribution.available is False


def test_zero_confidence_trust_excluded_not_treated_as_low_risk(request_, zero_confidence_trust):
    engine = RiskFusionEngine()
    result = engine.fuse(_context(request_, trust=zero_confidence_trust))
    trust_contribution = next(c for c in result.contributions if c.source.value == "trust")
    assert trust_contribution.available is False


def test_trust_score_is_inverted_to_risk_orientation(request_, high_trust):
    """high_trust.trust_score=0.9 (good) must become a LOW risk contribution,
    not a high one - trust and risk are inverse orientations."""
    engine = RiskFusionEngine()
    result = engine.fuse(_context(request_, trust=high_trust))
    trust_contribution = next(c for c in result.contributions if c.source.value == "trust")
    assert trust_contribution.risk_value < 0.2


def test_conflicting_evidence_is_weighed_not_blindly_resolved(
    request_, high_risk_behavioral, low_risk_graph, high_trust, clean_compliance
):
    """The exact example from the spec: behavioral high, graph low, trust
    high, compliance clean - must not blindly reject or approve, must
    produce a weighed middle-ground score reflecting all four inputs."""
    engine = RiskFusionEngine()
    result = engine.fuse(
        _context(request_, high_risk_behavioral, low_risk_graph, high_trust, clean_compliance)
    )
    # Behavioral (0.30 weight) pulls risk up, the other three pull it down -
    # the result must land clearly below a naive "high risk" reading but
    # still reflect the behavioral signal, i.e. a genuine weighted blend.
    assert 0.05 < result.overall_risk_score < 0.4
