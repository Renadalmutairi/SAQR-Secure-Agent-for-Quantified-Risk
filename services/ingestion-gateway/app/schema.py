from datetime import UTC, datetime, timedelta

from pydantic import BaseModel

# Matches Agent 1's TransactionEvent field-for-field so both Agent 1's
# KafkaTransactionSource and Agent 2's raw-tx consumer parse the same shape
# without translation. IS_FRAUD/ALERT_ID are never read from the CSV here,
# same principle as Agent 1: neither agent should ever see fraud labels.
_SYNTHETIC_EPOCH = datetime(2026, 1, 1, tzinfo=UTC)
_STEP_UNIT = timedelta(hours=1)


class RawTransactionEvent(BaseModel):
    tx_id: str
    sender_account_id: str
    receiver_account_id: str
    tx_type: str
    amount: float
    occurred_at: datetime
    raw_timestamp_step: int | None = None


def parse_row(row: dict) -> RawTransactionEvent:
    step = int(row["TIMESTAMP"])
    return RawTransactionEvent(
        tx_id=row["TX_ID"],
        sender_account_id=row["SENDER_ACCOUNT_ID"],
        receiver_account_id=row["RECEIVER_ACCOUNT_ID"],
        tx_type=row["TX_TYPE"],
        amount=float(row["TX_AMOUNT"]),
        occurred_at=_SYNTHETIC_EPOCH + step * _STEP_UNIT,
        raw_timestamp_step=step,
    )
