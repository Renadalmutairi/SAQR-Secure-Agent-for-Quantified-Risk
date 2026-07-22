import re

import pytest

from app.domain.entities import TokenStage, TokenStageStatus
from app.infra.memory.in_memory_customer_account_repository import InMemoryCustomerAccountRepository
from app.infra.memory.in_memory_token_repository import InMemoryTokenRepository
from app.token_station.generator import generate_token
from app.token_station.service import TokenStationService

_TOKEN_FORMAT = re.compile(r"^SAQR-TX-[0-9A-F]{8}$")


def test_token_format_is_human_readable_and_secure():
    token = generate_token()
    assert _TOKEN_FORMAT.match(token)


def test_tokens_are_unique_across_many_generations():
    tokens = {generate_token() for _ in range(5000)}
    assert len(tokens) == 5000


@pytest.fixture
def repo() -> InMemoryTokenRepository:
    return InMemoryTokenRepository()


@pytest.fixture
def customer_accounts() -> InMemoryCustomerAccountRepository:
    return InMemoryCustomerAccountRepository()


@pytest.fixture
def token_service(repo, customer_accounts) -> TokenStationService:
    return TokenStationService(repository=repo, customer_accounts=customer_accounts)


@pytest.mark.asyncio
async def test_generate_mints_a_new_saqr_format_token(token_service):
    entry = await token_service.get_or_create_token(
        transaction_id=None, account_id="acc-1", receiver_account_id="acc-2", amount=100.0, transaction_type="TRANSFER"
    )
    assert _TOKEN_FORMAT.match(entry.transaction_id)
    assert entry.behavioral_status == TokenStageStatus.PENDING
    assert entry.customer_id  # resolved via CustomerAccountRepository


@pytest.mark.asyncio
async def test_generate_resolves_customer_id_from_account(token_service, customer_accounts):
    entry = await token_service.get_or_create_token(
        transaction_id=None, account_id="acc-42", receiver_account_id="acc-2", amount=1.0, transaction_type="TRANSFER"
    )
    resolved = await customer_accounts.customer_for_account("acc-42")
    assert entry.customer_id == resolved.customer_id


@pytest.mark.asyncio
async def test_known_transaction_id_never_regenerates_an_existing_token(token_service, repo):
    first = await token_service.get_or_create_token(
        transaction_id="tx-100", account_id="acc-1", receiver_account_id="acc-2", amount=50.0, transaction_type="TRANSFER"
    )
    second = await token_service.get_or_create_token(
        transaction_id="tx-100", account_id="acc-1", receiver_account_id="acc-2", amount=50.0, transaction_type="TRANSFER"
    )
    assert first.transaction_id == second.transaction_id == "tx-100"
    timeline = await repo.get_timeline("tx-100")
    assert len(timeline) == 1  # exactly one "Token Created" event, not two
    assert timeline[0].event == "Token Created"


@pytest.mark.asyncio
async def test_two_different_transaction_ids_get_two_distinct_registry_rows(token_service):
    a = await token_service.get_or_create_token(
        transaction_id="tx-A", account_id="acc-1", receiver_account_id="acc-2", amount=1.0, transaction_type="TRANSFER"
    )
    b = await token_service.get_or_create_token(
        transaction_id="tx-B", account_id="acc-1", receiver_account_id="acc-2", amount=1.0, transaction_type="TRANSFER"
    )
    assert a.transaction_id != b.transaction_id


@pytest.mark.asyncio
async def test_full_stage_sequence_produces_exactly_the_ten_spec_events(token_service, repo):
    entry = await token_service.get_or_create_token(
        transaction_id=None, account_id="acc-1", receiver_account_id="acc-2", amount=10.0, transaction_type="TRANSFER"
    )
    token = entry.transaction_id

    for stage in [TokenStage.BEHAVIORAL, TokenStage.GRAPH, TokenStage.TRUST, TokenStage.COMPLIANCE]:
        await token_service.update_stage_status(token, stage, TokenStageStatus.RUNNING)
        await token_service.update_stage_status(token, stage, TokenStageStatus.COMPLETED, result={"ok": True})
    await token_service.update_stage_status(token, TokenStage.DECISION, TokenStageStatus.RUNNING)
    await token_service.update_stage_status(token, TokenStage.DECISION, TokenStageStatus.COMPLETED, result={"decision": "APPROVE"})

    timeline = await repo.get_timeline(token)
    events = [e.event for e in timeline]
    assert events == [
        "Token Created",
        "Behavioral DNA Started",
        "Behavioral DNA Finished",
        "Graph Analysis Started",
        "Graph Analysis Finished",
        "Trust Evaluation Started",
        "Trust Evaluation Finished",
        "Compliance Started",
        "Compliance Finished",
        "Decision Generated",  # no "Decision Started" - matches the spec's exact list
    ]

    final = await token_service.get_token(token)
    assert final.decision_status == TokenStageStatus.COMPLETED

    results = await token_service.get_stage_results(token)
    decision_result = next(r for r in results if r.stage == TokenStage.DECISION)
    assert decision_result.result == {"decision": "APPROVE"}


@pytest.mark.asyncio
async def test_failed_stage_is_recorded_not_hidden(token_service, repo):
    entry = await token_service.get_or_create_token(
        transaction_id=None, account_id="acc-1", receiver_account_id="acc-2", amount=10.0, transaction_type="TRANSFER"
    )
    token = entry.transaction_id

    await token_service.update_stage_status(token, TokenStage.GRAPH, TokenStageStatus.RUNNING)
    await token_service.update_stage_status(token, TokenStage.GRAPH, TokenStageStatus.FAILED, detail="connection refused")

    final = await token_service.get_token(token)
    assert final.graph_status == TokenStageStatus.FAILED

    timeline = await repo.get_timeline(token)
    failed_event = timeline[-1]
    assert failed_event.event == "Graph Analysis Failed"
    assert failed_event.detail == "connection refused"


@pytest.mark.asyncio
async def test_db_status_reflects_repository_state(token_service, repo):
    assert await token_service.is_database_online() is True
    repo.online = False
    assert await token_service.is_database_online() is False
