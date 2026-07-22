import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.db.base import Base


class CustomerModel(Base):
    __tablename__ = "customers"

    customer_id: Mapped[str] = mapped_column(String, primary_key=True)
    display_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AccountModel(Base):
    __tablename__ = "accounts"

    account_id: Mapped[str] = mapped_column(String, primary_key=True)
    product_type: Mapped[str] = mapped_column(String, default="TRANSACTION_ACCOUNT")
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CustomerAccountLinkModel(Base):
    """Many-to-many: one customer may own many accounts/cards/products."""

    __tablename__ = "customer_account_links"
    __table_args__ = (UniqueConstraint("customer_id", "account_id", name="uq_customer_account"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.customer_id"), index=True)
    account_id: Mapped[str] = mapped_column(String, ForeignKey("accounts.account_id"), index=True, unique=True)
    role: Mapped[str] = mapped_column(String, default="owner")
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class BehavioralDnaProfileModel(Base):
    """Append-only. Rows are never UPDATEd except to flip is_current/valid_to when
    superseded by a newer version - the behavioral content itself is immutable."""

    __tablename__ = "behavioral_dna_profiles"
    __table_args__ = (UniqueConstraint("customer_id", "version", name="uq_customer_profile_version"),)

    profile_id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.customer_id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    dna_vector: Mapped[list] = mapped_column(JSONB)
    trusted_beneficiaries: Mapped[dict] = mapped_column(JSONB)
    history_depth: Mapped[int] = mapped_column(Integer)
    source_tx_id: Mapped[str | None] = mapped_column(String, nullable=True)
    behavioral_risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float)
    similarity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    changed_features: Mapped[list] = mapped_column(JSONB)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    prev_version_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    content_hash: Mapped[str] = mapped_column(String)
    is_current: Mapped[bool] = mapped_column(Boolean, index=True)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    schema_version: Mapped[str] = mapped_column(String, default="1.0")


class BackfillCheckpointModel(Base):
    """One row per backfill run. Advanced only after a full batch (DB writes + Kafka
    sends for every shard) is confirmed committed, so `byte_offset` always points to
    a safe resume point - never mid-batch.
    """

    __tablename__ = "backfill_checkpoints"

    run_id: Mapped[str] = mapped_column(String, primary_key=True)
    csv_path: Mapped[str] = mapped_column(String)
    byte_offset: Mapped[int] = mapped_column(Integer, default=0)
    rows_processed: Mapped[int] = mapped_column(Integer, default=0)
    last_tx_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="running")  # running | completed | failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TokenRegistryModel(Base):
    """Master registry row for one SAQR token - the token IS transaction_id, used
    everywhere in SAQR. Created exactly once (enforced by the primary key itself, not
    just application logic); only the 5 status columns are ever updated thereafter."""

    __tablename__ = "token_registry"

    transaction_id: Mapped[str] = mapped_column(String, primary_key=True)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.customer_id"), index=True)
    account_id: Mapped[str] = mapped_column(String, ForeignKey("accounts.account_id"), index=True)
    receiver_account_id: Mapped[str] = mapped_column(String)
    amount: Mapped[float] = mapped_column(Float)
    transaction_type: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    behavioral_status: Mapped[str] = mapped_column(String, default="pending")
    graph_status: Mapped[str] = mapped_column(String, default="pending")
    trust_status: Mapped[str] = mapped_column(String, default="pending")
    compliance_status: Mapped[str] = mapped_column(String, default="pending")
    decision_status: Mapped[str] = mapped_column(String, default="pending")


class TokenAuditEventModel(Base):
    """Append-only - never UPDATEd or DELETEd. This table alone is what the dashboard
    timeline renders; nothing about it is synthesized client-side."""

    __tablename__ = "token_audit_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id: Mapped[str] = mapped_column(
        String, ForeignKey("token_registry.transaction_id"), index=True
    )
    event: Mapped[str] = mapped_column(String)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TokenStageResultModel(Base):
    """One row per (transaction_id, stage) - the real response payload captured from
    whichever agent ran that stage. Upserted, never appended-to like the audit table."""

    __tablename__ = "token_stage_results"
    __table_args__ = (UniqueConstraint("transaction_id", "stage", name="uq_token_stage"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id: Mapped[str] = mapped_column(
        String, ForeignKey("token_registry.transaction_id"), index=True
    )
    stage: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    result_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AccountBehavioralContextModel(Base):
    __tablename__ = "account_behavioral_contexts"
    __table_args__ = (UniqueConstraint("account_id", "version", name="uq_account_context_version"),)

    context_id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    account_id: Mapped[str] = mapped_column(String, ForeignKey("accounts.account_id"), index=True)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.customer_id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    dna_vector: Mapped[list] = mapped_column(JSONB)
    history_depth: Mapped[int] = mapped_column(Integer)
    source_tx_id: Mapped[str | None] = mapped_column(String, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, index=True)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
