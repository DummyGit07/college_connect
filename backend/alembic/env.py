import sys
from os.path import abspath, dirname
from logging.config import fileConfig

# Ensure project root/backend directory is on Python's module search path
sys.path.insert(0, dirname(dirname(abspath(__file__))))

from sqlalchemy import engine_from_config, create_engine, pool
from alembic import context
from src.database.db import Base
from src.schemas.user import User
from src.schemas.otp import EmailOTP
from src.config import settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Model metadata for autogenerate support
target_metadata = Base.metadata

# Resolve DB URL dynamically based on LOCAL toggle
db_url = settings.LOCAL_DB_URL if settings.LOCAL else settings.DATABASE_URL
config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connect_args = {}
    if settings.LOCAL:
        connect_args = {"check_same_thread": False}

    connectable = create_engine(
        db_url,
        connect_args=connect_args,
        poolclass=pool.NullPool,
        pool_pre_ping=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
