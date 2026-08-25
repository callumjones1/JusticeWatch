"""Database engine/session setup for the ETL pipeline.

Defaults to a local SQLite file under backend/data/db/. Override with the
DATABASE_URL env var (e.g. a Neon/Postgres URL) for production -- see
backend/.env.example. This is the same env var name Render/Heroku/Railway
auto-inject for their own managed Postgres add-ons, so it lines up with the
wider ecosystem even though we're pointing it at Neon manually.
"""

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_PATH = BACKEND_ROOT / "data" / "db" / "justice_watch.db"


def get_database_url() -> str:
    env_url = os.environ.get("DATABASE_URL")
    if env_url:
        # Some providers still hand out the legacy "postgres://" scheme;
        # SQLAlchemy 2.0's default psycopg2 dialect requires "postgresql://".
        if env_url.startswith("postgres://"):
            env_url = "postgresql://" + env_url[len("postgres://"):]
        return env_url
    DEFAULT_SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"


def get_engine():
    url = get_database_url()
    connect_args = {"timeout": 30} if url.startswith("sqlite") else {}
    engine = create_engine(url, connect_args=connect_args)
    if url.startswith("sqlite"):
        from sqlalchemy import event

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine


def get_session_factory(engine=None) -> sessionmaker:
    engine = engine or get_engine()
    return sessionmaker(bind=engine, expire_on_commit=False, class_=Session)
