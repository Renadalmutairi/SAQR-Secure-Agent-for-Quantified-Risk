from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAQR_", env_file=".env", extra="ignore")

    env: str = "local"

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "saqr_graph_pw"

    kafka_bootstrap_servers: str = "localhost:9092"
    raw_tx_topic: str = "saqr.transactions.raw"
    behavioral_dna_topic: str = "saqr.behavioral-dna.profile-updates"
    output_topic: str = "saqr.graph-intelligence.updates"
    consumer_group_id: str = "graph-intelligence-engine"

    cold_path_interval_seconds: float = 60.0
    embedding_dimensions: int = 128
    sparsify_min_weight: float = 1.0
    sparsify_max_age_days: int = 180
    expansion_hop: int = 4

    api_host: str = "0.0.0.0"
    api_port: int = 8002


def get_settings() -> Settings:
    return Settings()
