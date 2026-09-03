"""
IoT Remote Monitoring Dashboard — Database Connection

Async SQLAlchemy engine and session factory for PostgreSQL/TimescaleDB.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Async engine — connection pool to PostgreSQL / Supabase
# statement_cache_size=0 ensures compatibility with Supabase poolers (Supavisor / pgbouncer)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args={"statement_cache_size": 0},
    pool_size=5,
    max_overflow=5,
    pool_recycle=300,
    pool_pre_ping=True,
)

# Session factory — creates new sessions for each request
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a database session per request."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
