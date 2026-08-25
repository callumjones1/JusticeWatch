"""Shared FastAPI dependencies."""

from collections.abc import Iterator

from sqlalchemy.orm import Session

from etl.db import get_engine, get_session_factory

_session_factory = get_session_factory(get_engine())


def get_db() -> Iterator[Session]:
    db = _session_factory()
    try:
        yield db
    finally:
        db.close()
