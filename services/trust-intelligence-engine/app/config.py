from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAQR_", env_file=".env", extra="ignore")

    env: str = "local"

    behavioral_dna_base_url: str = "http://localhost:8001"
    graph_intelligence_base_url: str = "http://localhost:8002"
    upstream_timeout_seconds: float = 3.0

    history_depth_scale: float = 30.0

    api_host: str = "0.0.0.0"
    api_port: int = 8003


def get_settings() -> Settings:
    return Settings()
