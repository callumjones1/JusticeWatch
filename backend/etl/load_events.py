"""Stream-load the pre-clustered protest-events JSON into SQLite.

Source is already event-centric (produced by an external pipeline) -- this
script does no clustering, just flattening into normalized tables. The
file is ~500MB, so this streams with ijson rather than json.load(). Rebuilds
all tables from scratch on every run (the JSON file is the source of truth).

Usage:
    python -m etl.load_events [path/to/source.json]
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import ijson
from sqlalchemy import insert

from etl.db import get_engine
from etl.text_grouping import category_group_key
from etl.models import (
    Base,
    Event,
    EventEvidence,
    EventIssueCategory,
    EventLegalOutcome,
    EventLinkedArticle,
    EventLocation,
    EventNumber,
    EventParticipant,
    EventPolicingActivity,
    EventQuote,
    EventReportedDate,
    EventReportedStatus,
)

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = BACKEND_ROOT / "data" / "raw" / "protest_events_dataset.json"

BATCH_SIZE = 500

NUMBER_TYPES = [
    ("crowdEstimates", "crowd"),
    ("arrestCounts", "arrest"),
    ("chargedCounts", "charged"),
    ("injuryCounts", "injury"),
]

PARTICIPANT_GROUPS = [
    ("protestGroups", "protest_group", "description"),
    ("protestSpokespeople", "protest_spokesperson", "name"),
    ("policeAndGovernmentOrganisations", "authority_org", "description"),
    ("policeAndGovernmentSpokespeople", "authority_spokesperson", "name"),
]


def _dump(value) -> str | None:
    if not value:
        return None
    # ijson parses numbers as decimal.Decimal by default -- not natively
    # JSON-serializable, so coerce anything json.dumps can't handle to float.
    return json.dumps(value, ensure_ascii=False, default=float)


def _f(value) -> float | None:
    """Coerce ijson's decimal.Decimal (used for any fractional number) to
    float for columns typed Float -- sqlite3 has no default Decimal adapter."""
    return float(value) if value is not None else None


class Batch:
    """Accumulates rows across tables and flushes them in one transaction."""

    def __init__(self, engine):
        self.engine = engine
        self.reset()

    def reset(self):
        self.events: list[dict] = []
        self.issue_categories: list[dict] = []
        self.locations: list[dict] = []
        self.numbers: list[dict] = []
        self.participants: list[dict] = []
        self.policing_activities: list[dict] = []
        self.legal_outcomes: list[dict] = []
        self.evidence: list[dict] = []
        self.quotes: list[dict] = []
        self.reported_dates: list[dict] = []
        self.reported_statuses: list[dict] = []
        self.linked_articles: list[dict] = []

    def flush(self):
        if not self.events:
            return
        with self.engine.begin() as conn:
            conn.execute(insert(Event), self.events)
            for rows, model in [
                (self.issue_categories, EventIssueCategory),
                (self.locations, EventLocation),
                (self.numbers, EventNumber),
                (self.participants, EventParticipant),
                (self.policing_activities, EventPolicingActivity),
                (self.legal_outcomes, EventLegalOutcome),
                (self.evidence, EventEvidence),
                (self.quotes, EventQuote),
                (self.reported_dates, EventReportedDate),
                (self.reported_statuses, EventReportedStatus),
                (self.linked_articles, EventLinkedArticle),
            ]:
                if rows:
                    conn.execute(insert(model), rows)
        self.reset()


def load(source_path: Path):
    engine = get_engine()

    print(f"Rebuilding schema at {engine.url} ...")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    batch = Batch(engine)
    n_events = 0
    n_links = 0
    n_quotes = 0
    started = time.time()

    with open(source_path, "rb") as f:
        for e in ijson.items(f, "events.item"):
            event_id = e.get("eventId")
            if not event_id:
                continue

            date = e.get("eventDate") or {}
            cause = e.get("cause") or {}
            coverage = e.get("coverage") or {}
            flags = e.get("flags") or {}
            numbers = e.get("numbers") or {}
            participants = e.get("participants") or {}
            locations = e.get("locations") or []
            quotes = e.get("quotes") or []
            evidence = e.get("evidence") or []

            primary_loc = locations[0] if locations else {}

            batch.events.append(
                {
                    "event_id": event_id,
                    "title_core": e.get("titleCore"),
                    "display_title": e.get("displayTitle") or event_id,
                    "status": e.get("status"),
                    "date_start": date.get("start"),
                    "date_end": date.get("end"),
                    "date_precision": date.get("precision"),
                    "date_reported_text": date.get("reported"),
                    "date_basis": date.get("basis"),
                    "date_year": date.get("year"),
                    "cause_summary": cause.get("summary"),
                    "cause_alt_summaries_json": _dump(cause.get("alternativeSummaries")),
                    "protesting_for_json": _dump(cause.get("protestingFor")),
                    "protesting_against_json": _dump(cause.get("protestingAgainst")),
                    "article_count": coverage.get("articleCount") or 0,
                    "coded_mention_count": coverage.get("codedMentionCount") or 0,
                    "framing": coverage.get("framing"),
                    "framing_breakdown_json": _dump(coverage.get("framingBreakdown")),
                    "publications_json": _dump(coverage.get("publications")),
                    "flag_arrest": bool(flags.get("arrest")),
                    "flag_court": bool(flags.get("court")),
                    "flag_force": bool(flags.get("force")),
                    "flag_legal": bool(flags.get("legal")),
                    "flag_policing": bool(flags.get("policing")),
                    "primary_state": primary_loc.get("stateOrTerritory"),
                    "primary_city": primary_loc.get("city"),
                    "quote_count": len(quotes),
                    "evidence_count": len(evidence),
                }
            )
            n_events += 1

            for cat in cause.get("issueCategories") or []:
                batch.issue_categories.append(
                    {"event_id": event_id, "category": cat, "group_key": category_group_key(cat)}
                )

            for l_idx, loc in enumerate(locations):
                batch.locations.append(
                    {
                        "event_id": event_id,
                        "location_index": l_idx,
                        "venue": loc.get("venue"),
                        "city": loc.get("city"),
                        "state_or_territory": loc.get("stateOrTerritory"),
                        "country": loc.get("country"),
                        "precision": loc.get("precision"),
                        "article_ids_json": _dump(loc.get("articleIds")),
                    }
                )

            for field_name, number_type in NUMBER_TYPES:
                for n in numbers.get(field_name) or []:
                    batch.numbers.append(
                        {
                            "event_id": event_id,
                            "number_type": number_type,
                            "value_text": n.get("value") or "",
                            "article_ids_json": _dump(n.get("articleIds")),
                        }
                    )

            for field_name, side, name_field in PARTICIPANT_GROUPS:
                for p in participants.get(field_name) or []:
                    batch.participants.append(
                        {
                            "event_id": event_id,
                            "side": side,
                            "name_or_description": p.get(name_field) or "",
                            "roles_json": _dump(p.get("roles")),
                            "organisations_json": _dump(p.get("organisations")),
                            "quoted": p.get("quoted"),
                            "article_ids_json": _dump(p.get("articleIds")),
                        }
                    )

            for pa in e.get("policingActivities") or []:
                batch.policing_activities.append(
                    {
                        "event_id": event_id,
                        "description": pa.get("description") or "",
                        "article_ids_json": _dump(pa.get("articleIds")),
                    }
                )

            for lo in e.get("legalOutcomes") or []:
                batch.legal_outcomes.append(
                    {
                        "event_id": event_id,
                        "description": lo.get("description") or "",
                        "article_ids_json": _dump(lo.get("articleIds")),
                    }
                )

            for ev in evidence:
                batch.evidence.append(
                    {
                        "event_id": event_id,
                        "document_id": ev.get("documentId"),
                        "unit_id": ev.get("unitId"),
                        "start_character": ev.get("startCharacter"),
                        "end_character": ev.get("endCharacter"),
                        "text": ev.get("text"),
                        "fields_json": _dump(ev.get("fields")),
                    }
                )

            for q in quotes:
                batch.quotes.append(
                    {
                        "event_id": event_id,
                        "document_id": q.get("documentId"),
                        "quote_id": q.get("quoteId"),
                        "speaker_name": q.get("speakerName"),
                        "speaker_organisation": q.get("speakerOrganisation"),
                        "speaker_type": q.get("speakerType"),
                        "stance_toward_protest": q.get("stanceTowardProtest"),
                        "text": q.get("text"),
                        "word_count": q.get("wordCount"),
                        "start_character": q.get("startCharacter"),
                        "end_character": q.get("endCharacter"),
                        "assignment_basis_json": _dump(q.get("assignmentBasis")),
                    }
                )
                n_quotes += 1

            for rd in e.get("reportedDates") or []:
                batch.reported_dates.append(
                    {
                        "event_id": event_id,
                        "start_date": rd.get("startDate"),
                        "end_date": rd.get("endDate"),
                        "precision": rd.get("precision"),
                        "reported_text": rd.get("reportedText"),
                        "article_ids_json": _dump(rd.get("articleIds")),
                    }
                )

            for rs in e.get("reportedStatuses") or []:
                batch.reported_statuses.append(
                    {
                        "event_id": event_id,
                        "value": rs.get("value"),
                        "article_ids_json": _dump(rs.get("articleIds")),
                    }
                )

            for la in e.get("linkedArticles") or []:
                qm = la.get("quoteMetrics") or {}
                rel = la.get("relevanceAnalysis") or {}
                batch.linked_articles.append(
                    {
                        "event_id": event_id,
                        "document_id": la.get("documentId"),
                        "headline": la.get("headline"),
                        "byline": la.get("byline"),
                        "publication": la.get("publication"),
                        "publication_date": la.get("publicationDate"),
                        "publication_time": la.get("publicationTime"),
                        "section": la.get("section"),
                        "page": la.get("page"),
                        "edition": la.get("edition"),
                        "word_count": la.get("wordCount"),
                        "source_code": la.get("sourceCode"),
                        "source_year": la.get("sourceYear"),
                        "source_relative_path": la.get("sourceRelativePath"),
                        "framing": la.get("framing"),
                        "framing_confidence": _f(la.get("framingConfidence")),
                        "framing_reason": la.get("framingReason"),
                        "relevance": rel.get("relevance"),
                        "relevance_category": rel.get("relevanceCategory"),
                        "relevance_confidence": _f(rel.get("relevanceConfidence")),
                        "relevance_status": rel.get("relevanceStatus"),
                        "relevance_reason": rel.get("relevanceReason"),
                        "quote_metrics_json": _dump(qm),
                        "protest_record_ids_json": _dump(la.get("protestRecordIds")),
                        "evidence_unit_ids_json": _dump(la.get("evidenceUnitIds")),
                        "assigned_quote_ids_json": _dump(la.get("assignedQuoteIds")),
                    }
                )
                n_links += 1

            if len(batch.events) >= BATCH_SIZE:
                batch.flush()
                elapsed = time.time() - started
                print(f"  ... {n_events} events / {n_links} article-links / {n_quotes} quotes loaded ({elapsed:.0f}s)")

    batch.flush()
    elapsed = time.time() - started
    print(f"Done: {n_events} events, {n_links} article links, {n_quotes} quotes in {elapsed:.0f}s")


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not src.exists():
        print(f"Source file not found: {src}")
        sys.exit(1)
    load(src)
