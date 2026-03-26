import ssl
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

from app.config import get_settings

settings = get_settings()

# asyncpg uses connect_args for SSL, not query string params
_connect_args: dict = {}
_db_url = settings.DATABASE_URL
if "localhost" in _db_url or "127.0.0.1" in _db_url:
    _connect_args["ssl"] = False  # no SSL for local dev
elif "ssl=require" in _db_url or "sslmode=require" in _db_url:
    # Strip the ssl param from URL — pass it via connect_args instead
    _db_url = _db_url.replace("?ssl=require", "").replace("&ssl=require", "").replace("?sslmode=require", "").replace("&sslmode=require", "")
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE
    _connect_args["ssl"] = _ssl_ctx

engine = create_async_engine(
    _db_url,
    echo=settings.APP_DEBUG,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

async_session_factory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for getting a database session outside of FastAPI dependency injection.
    Useful for WebSocket handlers and background tasks.
    """
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
