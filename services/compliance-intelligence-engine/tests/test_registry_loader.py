from app.policy.registry_loader import YamlPolicyProvider


def test_loads_all_rules_from_real_registry_directory():
    """Exercises the actual compliance_policies/registry directory shipped
    with the project - a regression guard that the real YAML files stay
    parseable as the registry grows."""
    provider = YamlPolicyProvider("/Users/renad/saqrai/compliance_policies/registry")
    rules = provider.get_rules()
    assert len(rules) >= 25
    ids = [r.rule_id for r in rules]
    assert len(ids) == len(set(ids)), "duplicate rule_id in registry"


def test_missing_directory_returns_empty_list_not_error(tmp_path):
    provider = YamlPolicyProvider(str(tmp_path / "does-not-exist"))
    assert provider.get_rules() == []


def test_malformed_yaml_file_is_skipped_not_fatal(tmp_path):
    (tmp_path / "broken.yaml").write_text("not: valid: yaml: [[[")
    (tmp_path / "good.yaml").write_text(
        """
- rule_id: OK-001
  category: AML
  title: A valid rule
  source_document: TEST
  source_reference: n/a
  description: valid
  trigger: some_trigger
  severity: informational
"""
    )
    provider = YamlPolicyProvider(str(tmp_path))
    rules = provider.get_rules()
    assert len(rules) == 1
    assert rules[0].rule_id == "OK-001"


def test_rule_missing_required_field_is_skipped_not_fatal(tmp_path):
    (tmp_path / "partial.yaml").write_text(
        """
- rule_id: BAD-001
  category: AML
  title: Missing required fields
- rule_id: OK-002
  category: KYC_CDD
  title: A valid rule
  source_document: TEST
  source_reference: n/a
  description: valid
  trigger: some_trigger
  severity: blocking
"""
    )
    provider = YamlPolicyProvider(str(tmp_path))
    rules = provider.get_rules()
    assert len(rules) == 1
    assert rules[0].rule_id == "OK-002"


def test_rules_loaded_once_and_cached_for_process_lifetime(tmp_path):
    (tmp_path / "one.yaml").write_text(
        """
- rule_id: C-001
  category: OTHER
  title: r
  source_document: TEST
  source_reference: n/a
  description: r
  trigger: t
  severity: informational
"""
    )
    provider = YamlPolicyProvider(str(tmp_path))
    first = provider.get_rules()
    (tmp_path / "two.yaml").write_text(
        """
- rule_id: C-002
  category: OTHER
  title: r2
  source_document: TEST
  source_reference: n/a
  description: r2
  trigger: t2
  severity: informational
"""
    )
    second = provider.get_rules()
    assert first is second
    assert len(second) == 1
