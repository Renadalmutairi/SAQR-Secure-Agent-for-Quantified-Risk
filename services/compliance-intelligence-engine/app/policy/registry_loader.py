import logging
from pathlib import Path

import yaml

from app.domain.entities import PolicyRule
from app.domain.ports import PolicyProvider

logger = logging.getLogger(__name__)


class YamlPolicyProvider(PolicyProvider):
    """Loads every *.yaml file in the registry directory once at startup (a
    static configuration load - not a caching layer, no invalidation/TTL/
    refresh logic; the process must restart to pick up registry changes,
    exactly like Agent 1's FeatureRegistry or Agent 3's provider list).

    This is what makes the rule engine bank-agnostic: it has no idea whether
    the rules it's evaluating came from SAMA, an international standard-setter,
    or a bank-specific extension - it only ever sees typed PolicyRule objects.
    Institution-specific rules are added by dropping another YAML file into
    this directory (or a bank-specific subdirectory), never by editing engine
    code.
    """

    def __init__(self, registry_dir: str) -> None:
        self._registry_dir = Path(registry_dir)
        self._rules: list[PolicyRule] | None = None

    def get_rules(self) -> list[PolicyRule]:
        if self._rules is None:
            self._rules = self._load()
        return self._rules

    def _load(self) -> list[PolicyRule]:
        if not self._registry_dir.is_dir():
            logger.warning("policy registry directory not found: %s - starting with zero rules", self._registry_dir)
            return []

        rules: list[PolicyRule] = []
        for yaml_file in sorted(self._registry_dir.glob("*.yaml")):
            try:
                documents = yaml.safe_load(yaml_file.read_text()) or []
            except yaml.YAMLError:
                logger.exception("failed to parse policy registry file %s - skipping it", yaml_file)
                continue

            for raw_rule in documents:
                try:
                    rules.append(PolicyRule(**raw_rule))
                except Exception:
                    logger.exception(
                        "failed to load rule %s from %s - skipping it",
                        raw_rule.get("rule_id", "<unknown>"),
                        yaml_file,
                    )

        logger.info("loaded %s policy rules from %s", len(rules), self._registry_dir)
        return rules
