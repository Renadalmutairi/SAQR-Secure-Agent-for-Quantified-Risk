import csv
import random
from collections.abc import Iterator
from dataclasses import dataclass


@dataclass
class SampleTransaction:
    account_id: str
    receiver_account_id: str
    amount: float
    tx_type: str


def sample_real_transactions(csv_path: str, sample_size: int, seed: int | None = 42) -> list[SampleTransaction]:
    """Reservoir-samples `sample_size` real rows from the real transactions.csv without
    loading the whole file into memory. Only sender/receiver/amount/type are read -
    IS_FRAUD/ALERT_ID are never touched, the same hard rule enforced in every agent in
    this repo: fraud labels never leak into processing.
    """
    rng = random.Random(seed)
    reservoir: list[SampleTransaction] = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            item = SampleTransaction(
                account_id=row["SENDER_ACCOUNT_ID"],
                receiver_account_id=row["RECEIVER_ACCOUNT_ID"],
                amount=float(row["TX_AMOUNT"]),
                tx_type=row["TX_TYPE"],
            )
            if len(reservoir) < sample_size:
                reservoir.append(item)
            else:
                j = rng.randint(0, i)
                if j < sample_size:
                    reservoir[j] = item
    return reservoir


def count_real_transactions(csv_path: str) -> int:
    with open(csv_path, newline="") as f:
        return sum(1 for _ in f) - 1  # minus header row


_SYNTHETIC_TX_TYPES = ["TRANSFER", "WIRE", "PAYMENT"]
SYNTHETIC_ACCOUNT_PREFIX = "bench-acct-"


def generate_synthetic_transactions(
    customer_count: int, transaction_count: int, seed: int | None = 7
) -> Iterator[SampleTransaction]:
    """Generator (never materialized as a list) producing `transaction_count` synthetic
    transactions across `customer_count` distinct synthetic sender accounts - keeps
    memory flat even at 1,000,000 transactions. Account ids are prefixed so they're
    never confused with the real dataset and are trivially identifiable. Each unique
    sender account bootstraps its own customer via Agent 1's existing
    get_or_create_customer_for_account logic - no separate customer-creation step is
    needed to reach the stated 10,000-customer scale.
    """
    rng = random.Random(seed)
    for _ in range(transaction_count):
        sender_idx = rng.randint(0, customer_count - 1)
        receiver_idx = rng.randint(0, customer_count - 1)
        if receiver_idx == sender_idx:
            receiver_idx = (receiver_idx + 1) % customer_count
        yield SampleTransaction(
            account_id=f"{SYNTHETIC_ACCOUNT_PREFIX}{sender_idx:06d}",
            receiver_account_id=f"{SYNTHETIC_ACCOUNT_PREFIX}{receiver_idx:06d}",
            amount=round(rng.uniform(10.0, 5000.0), 2),
            tx_type=rng.choice(_SYNTHETIC_TX_TYPES),
        )
