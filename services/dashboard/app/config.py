from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAQR_", env_file=".env", extra="ignore")

    env: str = "local"

    behavioral_dna_base_url: str = "http://localhost:8001"
    graph_intelligence_base_url: str = "http://localhost:8002"
    trust_intelligence_base_url: str = "http://localhost:8003"
    compliance_base_url: str = "http://localhost:8004"
    decision_base_url: str = "http://localhost:8005"
    upstream_timeout_seconds: float = 10.0  # generous - a demo run awaits 5 real agent calls in sequence

    api_host: str = "0.0.0.0"
    api_port: int = 8080

    transactions_csv_path: str = "/data/transactions.csv"
    benchmark_jobs_dir: str = "/srv/benchmark_data/jobs"
    infra_snapshot_path: str = "/srv/benchmark_data/infra_snapshot.json"

    benchmark_pipeline_default_sample_size: int = 1000
    benchmark_pipeline_default_concurrency: int = 20
    # Real, measured throughput ceiling on this deployment plateaus well under what's
    # needed to complete a live 1,000,000-call run in one sitting (see token_benchmark's
    # docstring). benchmark_token_default_total is what actually runs live;
    # benchmark_token_full_target_size (the stated scale) is reported as a labeled
    # projection from the measured rate whenever the two differ.
    benchmark_token_default_total: int = 50_000
    benchmark_token_full_target_size: int = 1_000_000
    benchmark_token_default_customers: int = 5_000
    benchmark_token_default_concurrency: int = 60
    benchmark_db_default_sample_size: int = 300


def get_settings() -> Settings:
    return Settings()
