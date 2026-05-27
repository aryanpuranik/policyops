from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    import app.models  # noqa: F401 — registers all ORM models with Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_workflow_columns(conn)
        await _ensure_execution_columns(conn)


async def _ensure_workflow_columns(conn):
    """Best-effort lightweight schema evolution for existing SQLite DBs."""
    result = await conn.exec_driver_sql("PRAGMA table_info(workflows)")
    existing_columns = {row[1] for row in result.fetchall()}

    column_defs = {
        "version": "TEXT DEFAULT 'v1.0'",
        "approved_by": "TEXT",
        "approved_at": "DATETIME",
        "published_by": "TEXT",
        "published_at": "DATETIME",
        "source_document": "TEXT",
        "handoff_status": "JSON",
        "read_only": "BOOLEAN DEFAULT 0",
    }

    for column, definition in column_defs.items():
        if column not in existing_columns:
            await conn.exec_driver_sql(f"ALTER TABLE workflows ADD COLUMN {column} {definition}")


async def _ensure_execution_columns(conn):
    """Best-effort lightweight schema evolution for existing SQLite DBs."""
    result = await conn.exec_driver_sql("PRAGMA table_info(execution_runs)")
    existing_columns = {row[1] for row in result.fetchall()}

    column_defs = {
        "requires_input": "BOOLEAN DEFAULT 0",
        "input_schema": "JSON",
        "input_values": "JSON",
        "recipient_type": "TEXT",
        "recipient_email": "TEXT",
        "submitted_at": "DATETIME",
        "computed_variables": "JSON",
        "decisions": "JSON",
        "next_step_id": "TEXT",
        "decision_evaluated_at": "DATETIME",
    }

    for column, definition in column_defs.items():
        if column not in existing_columns:
            await conn.exec_driver_sql(f"ALTER TABLE execution_runs ADD COLUMN {column} {definition}")


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
