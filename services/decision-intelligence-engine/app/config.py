from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAQR_", env_file=".env", extra="ignore")

    env: str = "local"

    behavioral_dna_base_url: str = "http://localhost:8001"
    graph_intelligence_base_url: str = "http://localhost:8002"
    trust_intelligence_base_url: str = "http://localhost:8003"
    compliance_base_url: str = "http://localhost:8004"
    upstream_timeout_seconds: float = 3.0

    weight_behavioral: float = 0.30
    weight_graph: float = 0.25
    weight_trust: float = 0.25
    weight_compliance: float = 0.20

    risk_threshold_low: float = 0.25
    risk_threshold_medium: float = 0.50
    risk_threshold_high: float = 0.75

    api_host: str = "0.0.0.0"
    api_port: int = 8005


def get_settings() -> Settings:
    return Settings()
