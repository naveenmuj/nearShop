import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# Import ALL models so their metadata is registered with Base.
# ---------------------------------------------------------------------------
from app.core.database import Base  # noqa: E402

from app.auth.models import User, OTPCode, Follow, UserEvent, SearchLog  # noqa: E402, F401
from app.shops.models import Shop  # noqa: E402, F401
from app.products.models import Product, ProductEmbedding, Category, Wishlist  # noqa: E402, F401
from app.orders.models import Order  # noqa: E402, F401
from app.reviews.models import Review  # noqa: E402, F401
from app.deals.models import Deal  # noqa: E402, F401
from app.stories.models import Story  # noqa: E402, F401
from app.haggle.models import HaggleSession, HaggleMessage  # noqa: E402, F401
from app.loyalty.models import ShopCoinsLedger, Badge  # noqa: E402, F401
from app.community.models import CommunityPost, CommunityAnswer  # noqa: E402, F401
from app.reservations.models import Reservation  # noqa: E402, F401
from app.notifications.models import Notification  # noqa: E402, F401

target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# Only manage NearShop tables — ignore any pre-existing tables in the DB.
# ---------------------------------------------------------------------------
NEARSHOP_TABLES = {t.name for t in target_metadata.sorted_tables}


def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and reflected and name not in NEARSHOP_TABLES:
        return False
    return True


# ---------------------------------------------------------------------------
# Override sqlalchemy.url from app config so we have a single source of truth.
# ---------------------------------------------------------------------------
from app.config import get_settings  # noqa: E402

settings = get_settings()
# Escape % chars for configparser interpolation (e.g. %23 in passwords)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine,
    though an Engine is acceptable here as well.  By skipping the Engine
    creation we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the script
    output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine and associate a
    connection with the context.
    """
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
