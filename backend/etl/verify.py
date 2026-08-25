"""Sanity-check the loaded events data against protest_events_dataset.json's
own metadata.statistics. Read-only.

Usage:
    python -m etl.verify
"""

from __future__ import annotations

import sys
from collections import Counter

from sqlalchemy import func, select

from etl.db import get_engine, get_session_factory
from etl.models import (
    Event,
    EventEvidence,
    EventLinkedArticle,
    EventLocation,
    EventNumber,
    EventParticipant,
    EventQuote,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def counts(session):
    print("=== Counts ===")
    for label, model in [
        ("events", Event),
        ("linked_articles", EventLinkedArticle),
        ("quotes", EventQuote),
        ("evidence", EventEvidence),
        ("locations", EventLocation),
        ("numbers", EventNumber),
        ("participants", EventParticipant),
    ]:
        n = session.execute(select(func.count()).select_from(model)).scalar_one()
        print(f"{label:20s} {n:>10,}")
    print()


def article_count_distribution(session):
    print("=== article_count distribution ===")
    rows = session.execute(select(Event.article_count)).scalars().all()
    buckets = Counter()
    for n in rows:
        if n <= 1:
            buckets["1 (single-article)"] += 1
        elif n <= 3:
            buckets["2-3"] += 1
        elif n <= 10:
            buckets["4-10"] += 1
        elif n <= 50:
            buckets["11-50"] += 1
        else:
            buckets["51+"] += 1
    for label in ["1 (single-article)", "2-3", "4-10", "11-50", "51+"]:
        print(f"{label:20s} {buckets.get(label, 0):>10,}")
    print(f"max article_count: {max(rows) if rows else 0}")
    print()


def date_precision_breakdown(session):
    print("=== date_precision breakdown ===")
    rows = session.execute(select(Event.date_precision)).scalars().all()
    total = len(rows)
    counts_ = Counter(rows)
    for precision, n in counts_.most_common():
        pct = 100 * n / total if total else 0
        print(f"{str(precision):30s} {n:>8,}  ({pct:.1f}%)")
    print()


def max_nested_counts(session):
    print("=== Max nested-array sizes per event (capping sanity check) ===")
    for label, model in [("linked_articles", EventLinkedArticle), ("evidence", EventEvidence), ("quotes", EventQuote)]:
        row = session.execute(
            select(model.event_id, func.count().label("n")).group_by(model.event_id).order_by(func.count().desc()).limit(1)
        ).first()
        print(f"{label:20s} max={row.n if row else 0} (event_id={row.event_id if row else None})")
    print()


def spot_check(session, title_fragment: str):
    print(f"=== Spot check: title contains {title_fragment!r} ===")
    events = session.execute(
        select(Event).where(Event.display_title.ilike(f"%{title_fragment}%"))
    ).scalars().all()
    if not events:
        print("NOT FOUND")
        print()
        return
    for e in events[:5]:
        print(f"  [{e.event_id}] {e.display_title}")
        print(f"    status={e.status} date={e.date_start}..{e.date_end} ({e.date_precision})")
        print(f"    articles={e.article_count} quotes={e.quote_count} evidence={e.evidence_count}")
        print(f"    location={e.primary_city}, {e.primary_state}")
    print()


def run():
    session_factory = get_session_factory(get_engine())
    with session_factory() as session:
        counts(session)
        article_count_distribution(session)
        date_precision_breakdown(session)
        max_nested_counts(session)
        spot_check(session, "Vietnam War Moratorium")
        spot_check(session, "APEC")


if __name__ == "__main__":
    run()
