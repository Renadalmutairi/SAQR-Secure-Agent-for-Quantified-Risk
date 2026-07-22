import asyncio
import logging
import zlib

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.config import Settings
from app.domain.entities import TransactionEvent
from app.domain.ports import EventPublisher
from app.features.base import FeatureRegistry
from app.infra.db.checkpoint_store import CheckpointStore
from app.infra.db.postgres_profile_repository import PostgresProfileRepository
from app.ingestion.csv_source import CsvTransactionSource
from app.ingestion.pipeline.progress import BackfillProgress
from app.ingestion.pipeline.resolver_cache import WarmCustomerAccountResolver
from app.ingestion.pipeline.shard_worker import ShardWorker

logger = logging.getLogger(__name__)


def _shard_index(customer_id: str, shard_count: int) -> int:
    # zlib.crc32 instead of builtin hash() - hash() is randomized per process
    # (PYTHONHASHSEED), which would be fine within a single run but is an
    # unnecessary footgun; crc32 is stable, fast, and good enough for partitioning.
    return zlib.crc32(customer_id.encode("utf-8")) % shard_count


class BackfillPipeline:
    """Production backfill pipeline for Agent 1.

    Streams transactions.csv in constant memory, partitions work across shards by
    RESOLVED customer_id (never raw account_id - see shard_worker.py for why),
    batches DB writes and Kafka sends per generation instead of per transaction,
    and checkpoints only after a generation is durably committed - so an
    interrupted run resumes without ever reprocessing an already-committed
    transaction. Uses the exact same feature/comparator/updater code as the
    real-time scoring path (BehavioralDnaService); only the I/O batching differs.

    Concurrency is applied where it is actually safe and useful: hydration reads
    and Kafka sends (I/O-bound, safe to overlap). The generation's DB write is a
    SINGLE transaction, not one per shard - splitting it would let a crash commit
    part of a generation while the checkpoint stays behind, causing the next
    resume to reprocess (and double-count) those same transactions.
    """

    def __init__(
        self,
        run_id: str,
        csv_path: str,
        registry: FeatureRegistry,
        settings: Settings,
        profiles_repo: PostgresProfileRepository,
        publisher: EventPublisher,
        session_factory: async_sessionmaker,
        checkpoint_store: CheckpointStore,
    ) -> None:
        self.run_id = run_id
        self._csv_path = csv_path
        self._registry = registry
        self._settings = settings
        self._profiles_repo = profiles_repo
        self._publisher = publisher
        self._session_factory = session_factory
        self._checkpoint_store = checkpoint_store

        self._resolver = WarmCustomerAccountResolver(session_factory)
        self._source = CsvTransactionSource(csv_path)
        self._shards = [ShardWorker(i, registry, settings) for i in range(settings.backfill_shard_count)]
        self.progress = BackfillProgress(
            run_id, sample_window_seconds=settings.backfill_progress_log_interval_seconds
        )

    async def run(self) -> BackfillProgress:
        await self._resolver.warm_up()
        byte_offset, already_completed = await self._resume_or_start()

        if already_completed:
            self.progress.mark_status("completed")
            logger.info("backfill for %s already completed (run_id=%s) - nothing to do", self._csv_path, self.run_id)
            return self.progress

        try:
            generation: list[TransactionEvent] = []
            last_offset = byte_offset
            async for event, offset_after in self._source.stream_from_offset(
                byte_offset, self._settings.backfill_csv_queue_maxsize
            ):
                customer_id = self._resolver.resolve(event.sender_account_id)
                shard = self._shards[_shard_index(customer_id, len(self._shards))]
                shard.stage(event, customer_id)
                generation.append(event)
                last_offset = offset_after

                if len(generation) >= self._settings.backfill_generation_size:
                    await self._commit_generation(generation, last_offset)
                    generation = []

            if generation:
                await self._commit_generation(generation, last_offset)

            async with self._session_factory() as session, session.begin():
                await self._checkpoint_store.mark_completed(session, self.run_id)
            self.progress.mark_status("completed")
            logger.info("backfill run %s completed: %s", self.run_id, self.progress.snapshot())

        except Exception as exc:
            async with self._session_factory() as session, session.begin():
                await self._checkpoint_store.mark_failed(session, self.run_id, str(exc))
            self.progress.mark_status("failed")
            logger.exception("backfill run %s failed", self.run_id)
            raise

        return self.progress

    async def _resume_or_start(self) -> tuple[int, bool]:
        async with self._session_factory() as session:
            existing = await self._checkpoint_store.latest_for_csv(session, self._csv_path)
            if existing is not None:
                if existing.status in ("running", "failed"):
                    self.run_id = existing.run_id
                    self.progress = BackfillProgress(
                        self.run_id, sample_window_seconds=self._settings.backfill_progress_log_interval_seconds
                    )
                    logger.info(
                        "resuming backfill run %s from byte_offset=%s (%s rows already processed, previous status=%s)",
                        self.run_id, existing.byte_offset, existing.rows_processed, existing.status,
                    )
                    return existing.byte_offset, False
                if existing.status == "completed":
                    self.run_id = existing.run_id
                    return existing.byte_offset, True

            # `session` already has an auto-begun transaction from the
            # latest_for_csv() query above - session.begin() here would raise
            # "A transaction is already begun". Commit directly instead.
            await self._checkpoint_store.start(session, self.run_id, self._csv_path)
            await session.commit()
            return 0, False

    async def _commit_generation(self, generation: list[TransactionEvent], byte_offset_after: int) -> None:
        await self._hydrate_all_shards()

        all_outputs = []
        all_profile_versions = []
        all_context_versions = []
        for shard in self._shards:
            outputs, profile_versions, context_versions = shard.process_staged()
            all_outputs.extend(outputs)
            all_profile_versions.extend(profile_versions)
            all_context_versions.extend(context_versions)

        async with self._session_factory() as session, session.begin():
            await self._resolver.flush_pending(session)  # must precede profile inserts (FK to customers)
            await self._profiles_repo.bulk_append_versions(session, all_profile_versions)
            await self._profiles_repo.bulk_append_account_contexts(session, all_context_versions)
            await self._checkpoint_store.advance(
                session, self.run_id, byte_offset_after, len(generation), generation[-1].tx_id
            )

        # Kafka is a fan-out notification stream, not the audit system of record
        # (Postgres is) - enqueue every send for the generation concurrently, then
        # wait for delivery once. Awaiting send_nowait() sequentially one-by-one
        # for a 2000-message generation was itself a serialization bottleneck even
        # though each individual call is cheap/local - gather removes that.
        futures = await asyncio.gather(*(self._publisher.send_nowait(o) for o in all_outputs))
        await asyncio.gather(*futures)

        self.progress.record(len(generation))
        logger.info("backfill run %s progress: %s", self.run_id, self.progress.snapshot())

    async def _hydrate_all_shards(self) -> None:
        async def hydrate_customer(shard: ShardWorker, customer_id: str) -> None:
            profile = await self._profiles_repo.get_current(customer_id)
            shard.hydrate_customer(customer_id, profile)

        async def hydrate_account(shard: ShardWorker, account_id: str) -> None:
            context = await self._profiles_repo.get_current_account_context(account_id)
            shard.hydrate_account(account_id, context)

        tasks = []
        for shard in self._shards:
            tasks.extend(hydrate_customer(shard, cid) for cid in shard.pending_new_customer_ids())
            tasks.extend(hydrate_account(shard, aid) for aid in shard.pending_new_account_ids())
        if tasks:
            await asyncio.gather(*tasks)
