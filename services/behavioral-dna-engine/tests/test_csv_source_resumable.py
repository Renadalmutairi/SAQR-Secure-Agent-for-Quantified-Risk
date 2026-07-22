import pytest

from app.ingestion.csv_source import CsvTransactionSource


@pytest.fixture
def csv_path(tmp_path):
    path = tmp_path / "transactions.csv"
    rows = ["TX_ID,SENDER_ACCOUNT_ID,RECEIVER_ACCOUNT_ID,TX_TYPE,TX_AMOUNT,TIMESTAMP,IS_FRAUD,ALERT_ID"]
    for i in range(1, 51):
        rows.append(f"{i},acc-{i % 5},acc-{(i + 1) % 5},TRANSFER,{i * 10.0},{i},False,-1")
    path.write_text("\n".join(rows) + "\n")
    return str(path)


@pytest.mark.asyncio
async def test_stream_from_offset_zero_reads_every_row_in_order(csv_path):
    source = CsvTransactionSource(csv_path)
    events = [event async for event, _ in source.stream_from_offset(0)]
    assert len(events) == 50
    assert [e.tx_id for e in events] == [str(i) for i in range(1, 51)]


@pytest.mark.asyncio
async def test_resuming_from_a_midpoint_never_skips_or_duplicates_rows(csv_path):
    source = CsvTransactionSource(csv_path)

    first_half = []
    resume_offset = None
    async for event, offset_after in source.stream_from_offset(0):
        first_half.append(event)
        if len(first_half) == 20:
            resume_offset = offset_after
            break

    second_half = [event async for event, _ in source.stream_from_offset(resume_offset)]

    assert len(first_half) == 20
    assert len(second_half) == 30
    combined_tx_ids = [e.tx_id for e in first_half] + [e.tx_id for e in second_half]
    assert combined_tx_ids == [str(i) for i in range(1, 51)]
    assert len(set(combined_tx_ids)) == 50  # no duplicates


@pytest.mark.asyncio
async def test_fraud_and_alert_columns_are_never_exposed_on_the_parsed_event(csv_path):
    source = CsvTransactionSource(csv_path)
    events = [event async for event, _ in source.stream_from_offset(0)]
    for e in events:
        assert not hasattr(e, "is_fraud")
        assert not hasattr(e, "alert_id")
