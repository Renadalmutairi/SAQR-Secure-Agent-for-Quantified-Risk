from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAQR_", env_file=".env", extra="ignore")

    kafka_bootstrap_servers: str = "localhost:9092"
    raw_tx_topic: str = "saqr.transactions.raw"
    transactions_csv_path: str = "/data/transactions.csv"
    publish_batch_size: int = 2000
    progress_log_every: int = 10000


def get_settings() -> Settings:
    return Settings()
