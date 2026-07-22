import csv

from app.benchmark.dataset import (
    SYNTHETIC_ACCOUNT_PREFIX,
    count_real_transactions,
    generate_synthetic_transactions,
    sample_real_transactions,
)


def _write_csv(tmp_path, rows: int):
    path = tmp_path / "transactions.csv"
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["TX_ID", "SENDER_ACCOUNT_ID", "RECEIVER_ACCOUNT_ID", "TX_TYPE", "TX_AMOUNT", "TIMESTAMP", "IS_FRAUD", "ALERT_ID"])
        for i in range(rows):
            writer.writerow([i, f"acc-{i}", f"acc-{i + 1}", "TRANSFER", 100.0 + i, i, "False", -1])
    return str(path)


def test_count_real_transactions_excludes_header(tmp_path):
    path = _write_csv(tmp_path, 250)
    assert count_real_transactions(path) == 250


def test_sample_real_transactions_returns_exact_size(tmp_path):
    path = _write_csv(tmp_path, 1000)
    sample = sample_real_transactions(path, sample_size=100, seed=1)
    assert len(sample) == 100


def test_sample_real_transactions_never_leaks_fraud_fields(tmp_path):
    path = _write_csv(tmp_path, 100)
    sample = sample_real_transactions(path, sample_size=20, seed=1)
    for tx in sample:
        assert not hasattr(tx, "is_fraud")
        assert not hasattr(tx, "alert_id")


def test_sample_smaller_than_dataset_still_returns_full_size_when_dataset_smaller(tmp_path):
    path = _write_csv(tmp_path, 10)
    sample = sample_real_transactions(path, sample_size=100, seed=1)
    assert len(sample) == 10  # can't sample more rows than exist


def test_generate_synthetic_transactions_exact_count():
    items = list(generate_synthetic_transactions(customer_count=50, transaction_count=500, seed=1))
    assert len(items) == 500


def test_generate_synthetic_transactions_uses_distinct_bench_prefixed_accounts():
    items = list(generate_synthetic_transactions(customer_count=100, transaction_count=2000, seed=2))
    accounts = {tx.account_id for tx in items} | {tx.receiver_account_id for tx in items}
    assert all(a.startswith(SYNTHETIC_ACCOUNT_PREFIX) for a in accounts)
    # with 100 possible accounts and 2000 transactions, virtually all should appear
    assert len(accounts) > 90


def test_generate_synthetic_transactions_sender_never_equals_receiver():
    items = list(generate_synthetic_transactions(customer_count=20, transaction_count=1000, seed=3))
    assert all(tx.account_id != tx.receiver_account_id for tx in items)


def test_generate_synthetic_transactions_is_a_generator_not_a_list():
    gen = generate_synthetic_transactions(customer_count=10, transaction_count=1_000_000, seed=4)
    # constructing it must be O(1), not materialize 1,000,000 items up front
    first = next(gen)
    assert first.account_id.startswith(SYNTHETIC_ACCOUNT_PREFIX)
