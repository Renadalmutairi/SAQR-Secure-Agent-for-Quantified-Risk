from app.graph.complexity import ComplexityConfig, should_expand_neighborhood, structural_complexity_score


def test_low_fan_in_out_yields_low_complexity():
    score = structural_complexity_score(fan_in=1, fan_out=1)
    assert score < 0.2


def test_high_fan_in_alone_triggers_high_complexity():
    score = structural_complexity_score(fan_in=500, fan_out=1)
    assert score > 0.9


def test_high_fan_out_alone_triggers_high_complexity():
    score = structural_complexity_score(fan_in=1, fan_out=500)
    assert score > 0.9


def test_expansion_trigger_respects_threshold():
    config = ComplexityConfig(expansion_threshold=0.75)
    assert should_expand_neighborhood(0.8, config) is True
    assert should_expand_neighborhood(0.5, config) is False
