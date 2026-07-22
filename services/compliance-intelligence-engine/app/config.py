from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAQR_", env_file=".env", extra="ignore")

    env: str = "local"

    behavioral_dna_base_url: str = "http://localhost:8001"
    graph_intelligence_base_url: str = "http://localhost:8002"
    trust_intelligence_base_url: str = "http://localhost:8003"
    upstream_timeout_seconds: float = 3.0

    policy_registry_dir: str = "/data/compliance_policies/registry"

    api_host: str = "0.0.0.0"
    api_port: int = 8004


def get_settings() -> Settings:
    return Settings()
