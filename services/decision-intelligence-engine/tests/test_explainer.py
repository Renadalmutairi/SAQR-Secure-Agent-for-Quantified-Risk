from app.domain.entities import Decision, RiskLevel
from app.domain.ports import EvidenceContext
from app.fusion.engine import RiskFusionEngine
from app.fusion.explainer import build_decision_output


def _context(request_, behavioral=None, graph=None, trust=None, compliance=None):
    return EvidenceContext(request=request_, behavioral=behavioral, graph=graph, trust=trust, compliance=compliance)


def test_contributing_agents_lists_only_available_sources(request_, low_risk_behavioral, low_risk_graph):
    engine = RiskFusionEngine()
    context = _context(request_, behavioral=low_risk_behavioral, graph=low_risk_graph)
    fusion = engine.fuse(context)
    output = build_decision_output(request_, context, fusion, Decision.APPROVE, RiskLevel.LOW, None)

    assert set(output.contributing_agents) == {"behavioral_dna", "graph_intelligence"}
    assert "trust_intelligence" not in output.contributing_agents
    assert "compliance" not in output.contributing_agents


def test_low_risk_evidence_becomes_positive_factors(request_, low_risk_behavioral, low_risk_graph, high_trust):
    engine = RiskFusionEngine()
    context = _context(request_, behavioral=low_risk_behavioral, graph=low_risk_graph, trust=high_trust)
    fusion = engine.fuse(context)
    output = build_decision_output(request_, context, fusion, Decision.APPROVE, RiskLevel.LOW, None)

    assert len(output.positive_factors) > 0
    assert any("Behavioral DNA" in f for f in output.positive_factors)


def test_high_risk_evidence_becomes_negative_factors(request_, high_risk_behavioral, high_risk_graph):
    engine = RiskFusionEngine()
    context = _context(request_, behavioral=high_risk_behavioral, graph=high_risk_graph)
    fusion = engine.fuse(context)
    output = build_decision_output(request_, context, fusion, Decision.ESCALATE, RiskLevel.HIGH, None)

    assert any("Behavioral DNA" in f for f in output.negative_factors)
    assert any("anomaly" in f.lower() for f in output.negative_factors)


def test_violated_rules_always_surfaced_in_negative_factors(request_, blocking_compliance):
    engine = RiskFusionEngine()
    context = _context(request_, compliance=blocking_compliance)
    fusion = engine.fuse(context)
    output = build_decision_output(request_, context, fusion, Decision.REJECT, RiskLevel.CRITICAL, "override")

    assert any("AML-CDD-007" in f for f in output.negative_factors)


def test_override_reason_appears_in_reasoning(request_, blocking_compliance):
    engine = RiskFusionEngine()
    context = _context(request_, compliance=blocking_compliance)
    fusion = engine.fuse(context)
    reason = "compliance status is non_compliant - this overrides all other evidence"
    output = build_decision_output(request_, context, fusion, Decision.REJECT, RiskLevel.CRITICAL, reason)

    assert reason in output.reasoning
    assert "REJECT" in output.reasoning


def test_unavailable_agents_named_in_reasoning(request_, low_risk_behavioral):
    engine = RiskFusionEngine()
    context = _context(request_, behavioral=low_risk_behavioral)
    fusion = engine.fuse(context)
    output = build_decision_output(request_, context, fusion, Decision.APPROVE, RiskLevel.LOW, None)

    assert "graph_intelligence" in output.reasoning
    assert "trust_intelligence" in output.reasoning
    assert "compliance" in output.reasoning
