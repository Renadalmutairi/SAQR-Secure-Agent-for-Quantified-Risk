from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAQR_", env_file=".env", extra="ignore")

    env: str = "local"

    db_dsn: str = "postgresql+asyncpg://saqr:saqr@localhost:5432/saqr_behavioral_dna"
    db_pool_size: int = 20
    db_max_overflow: int = 20

    redis_url: str = "redis://localhost:6379/0"
    redis_enabled: bool = True
    redis_max_connections: int = 50

    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_output_topic: str = "saqr.behavioral-dna.profile-updates"
    kafka_enabled: bool = True
    # acks=1 (leader ack only) instead of "all" - durable enough for a fan-out
    # notification stream (Postgres, not Kafka, is Agent 1's audit system of
    # record) and far faster than waiting on full ISR replication per message.
    # aiokafka only accepts the literal values 0, 1, -1, or "all" for this.
    kafka_acks: int | str = 1
    kafka_linger_ms: int = 20

    min_history_for_full_confidence: int = 30

    api_host: str = "0.0.0.0"
    api_port: int = 8001

    transactions_csv_path: str = "/data/transactions.csv"

    # Backfill pipeline tuning
    backfill_shard_count: int = 8
    backfill_generation_size: int = 2000
    backfill_csv_queue_maxsize: int = 2000
    backfill_progress_log_interval_seconds: float = 5.0


def get_settings() -> Settings:
    return Settings()
