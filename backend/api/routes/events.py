"""Read-only query endpoints over the pre-clustered events dataset built by
backend/etl/. No clustering happens here -- the source data already merged
article-level protest mentions into events; this just serves it.

GET /api/events           -- paginated, filterable list of events
GET /api/events/facets     -- distinct filter values, for building a filter UI
GET /api/events/{id}       -- one event, full detail (nested arrays capped --
                               see CAP_* constants; some real events have up
                               to 271 linked articles / 1732 evidence units /
                               1315 quotes)
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import (
    ActivityOut,
    CategoryFacetOut,
    EventDetailOut,
    EventFlagsOut,
    EventSummaryOut,
    EvidenceUnitOut,
    FacetsOut,
    LinkedArticleOut,
    LocationOut,
    NumberEstimateOut,
    NumberGroupOut,
    NumbersOut,
    PaginatedEvents,
    ParticipantGroupOut,
    ParticipantOut,
    ParticipantsOut,
    QuoteOut,
)
from etl.models import (
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
)

router = APIRouter(prefix="/api/events", tags=["events"])

MAX_PAGE_SIZE = 100
CAP_LINKED_ARTICLES = 50
CAP_QUOTES = 30
CAP_EVIDENCE = 20
CAP_NUMBERS_PER_TYPE = 15
CAP_PARTICIPANTS_PER_SIDE = 30

SortByOption = Literal["date", "title", "location", "status", "articles", "quotes"]
SortDirOption = Literal["asc", "desc"]

_SORT_COLUMNS: dict[str, list] = {
    "date": [Event.date_start],
    "title": [Event.display_title],
    "location": [Event.primary_state, Event.primary_city],
    "status": [Event.status],
    "articles": [Event.article_count],
    "quotes": [Event.quote_count],
}


def _order_by(sort_by: SortByOption, sort_dir: SortDirOption):
    cols = _SORT_COLUMNS[sort_by]
    return [c.desc() for c in cols] if sort_dir == "desc" else [c.asc() for c in cols]


def _loads(text: str | None) -> list[str]:
    if not text:
        return []
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return []


def _categories_for_events(db: Session, event_ids: list[str]) -> dict[str, list[str]]:
    if not event_ids:
        return {}
    rows = db.execute(
        select(EventIssueCategory.event_id, EventIssueCategory.group_key, EventIssueCategory.category).where(
            EventIssueCategory.event_id.in_(event_ids)
        )
    ).all()
    by_event: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for event_id, group_key, category in rows:
        by_event[event_id][group_key].append(category)
    return {
        eid: [min(labels, key=lambda s: (len(s), s)) for labels in groups.values()]
        for eid, groups in by_event.items()
    }


def _flags(e: Event) -> EventFlagsOut:
    return EventFlagsOut(arrest=e.flag_arrest, court=e.flag_court, force=e.flag_force, legal=e.flag_legal, policing=e.flag_policing)


def _to_summary(e: Event, categories: list[str]) -> EventSummaryOut:
    return EventSummaryOut(
        event_id=e.event_id,
        display_title=e.display_title,
        title_core=e.title_core,
        status=e.status,
        date_start=e.date_start,
        date_end=e.date_end,
        date_precision=e.date_precision,
        date_reported_text=e.date_reported_text,
        primary_state=e.primary_state,
        primary_city=e.primary_city,
        article_count=e.article_count,
        quote_count=e.quote_count,
        evidence_count=e.evidence_count,
        issue_categories=sorted(categories),
        flags=_flags(e),
    )


@router.get("", response_model=PaginatedEvents)
def list_events(
    db: Session = Depends(get_db),
    year_from: int | None = Query(None),
    year_to: int | None = Query(None),
    state: str | None = Query(None, description="Exact match on primary_state"),
    category: str | None = Query(None, description="At least one issue category matches"),
    status: str | None = Query(None),
    flag_arrest: bool | None = Query(None),
    flag_court: bool | None = Query(None),
    flag_force: bool | None = Query(None),
    flag_legal: bool | None = Query(None),
    flag_policing: bool | None = Query(None),
    min_article_count: int | None = Query(None, ge=1),
    q: str | None = Query(None, min_length=1, description="Free-text match on the event's display title"),
    sort_by: SortByOption = "articles",
    sort_dir: SortDirOption = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
) -> PaginatedEvents:
    stmt = select(Event)

    if year_from is not None:
        stmt = stmt.where(Event.date_year >= year_from)
    if year_to is not None:
        stmt = stmt.where(Event.date_year <= year_to)
    if state:
        stmt = stmt.where(Event.primary_state == state)
    if status:
        stmt = stmt.where(Event.status == status)
    if flag_arrest is not None:
        stmt = stmt.where(Event.flag_arrest == flag_arrest)
    if flag_court is not None:
        stmt = stmt.where(Event.flag_court == flag_court)
    if flag_force is not None:
        stmt = stmt.where(Event.flag_force == flag_force)
    if flag_legal is not None:
        stmt = stmt.where(Event.flag_legal == flag_legal)
    if flag_policing is not None:
        stmt = stmt.where(Event.flag_policing == flag_policing)
    if min_article_count is not None:
        stmt = stmt.where(Event.article_count >= min_article_count)
    if q:
        stmt = stmt.where(Event.display_title.ilike(f"%{q}%"))
    if category:
        stmt = stmt.where(
            Event.event_id.in_(
                select(EventIssueCategory.event_id).where(EventIssueCategory.group_key == category)
            )
        )

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()

    stmt = stmt.order_by(*_order_by(sort_by, sort_dir)).offset((page - 1) * page_size).limit(page_size)
    events = db.execute(stmt).scalars().all()

    categories_by_event = _categories_for_events(db, [e.event_id for e in events])
    items = [_to_summary(e, categories_by_event.get(e.event_id, [])) for e in events]

    return PaginatedEvents(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/facets", response_model=FacetsOut)
def get_facets(db: Session = Depends(get_db)) -> FacetsOut:
    states = sorted(s for (s,) in db.execute(select(Event.primary_state).where(Event.primary_state.is_not(None)).distinct()))
    statuses = sorted(s for (s,) in db.execute(select(Event.status).where(Event.status.is_not(None)).distinct()))

    # Group near-duplicate category strings (see etl/text_grouping.py) so the
    # filter dropdown shows one "5G" entry instead of a dozen "5G ..." variants.
    # Canonical label = shortest member string (usually the cleanest phrasing).
    category_rows = db.execute(
        select(EventIssueCategory.group_key, EventIssueCategory.category, EventIssueCategory.event_id)
    ).all()
    by_key: dict[str, tuple[set[str], set[str]]] = defaultdict(lambda: (set(), set()))
    for group_key, category, event_id in category_rows:
        labels, event_ids = by_key[group_key]
        labels.add(category)
        event_ids.add(event_id)
    categories = sorted(
        (
            CategoryFacetOut(key=key, label=min(labels, key=lambda s: (len(s), s)), event_count=len(event_ids))
            for key, (labels, event_ids) in by_key.items()
        ),
        key=lambda c: c.label.lower(),
    )

    year_min, year_max = db.execute(select(func.min(Event.date_year), func.max(Event.date_year))).one()

    return FacetsOut(states=states, categories=categories, statuses=statuses, year_min=year_min, year_max=year_max)


@router.get("/{event_id}", response_model=EventDetailOut)
def get_event(event_id: str, db: Session = Depends(get_db)) -> EventDetailOut:
    e = db.get(Event, event_id)
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")

    # Dedupe this event's own categories by group_key too -- an event with
    # 271 linked articles can otherwise carry dozens of near-duplicate tags.
    cat_rows = db.execute(
        select(EventIssueCategory.group_key, EventIssueCategory.category).where(EventIssueCategory.event_id == event_id)
    ).all()
    cat_by_key: dict[str, list[str]] = defaultdict(list)
    for group_key, category in cat_rows:
        cat_by_key[group_key].append(category)
    categories = [min(labels, key=lambda s: (len(s), s)) for labels in cat_by_key.values()]

    locations = db.execute(select(EventLocation).where(EventLocation.event_id == event_id)).scalars().all()
    locations_out = [
        LocationOut(
            venue=loc.venue, city=loc.city, state_or_territory=loc.state_or_territory,
            country=loc.country, precision=loc.precision, article_ids=_loads(loc.article_ids_json),
        )
        for loc in locations
    ]

    numbers_out = _build_numbers(db, event_id)
    participants_out = _build_participants(db, event_id)

    policing = db.execute(select(EventPolicingActivity).where(EventPolicingActivity.event_id == event_id)).scalars().all()
    legal = db.execute(select(EventLegalOutcome).where(EventLegalOutcome.event_id == event_id)).scalars().all()

    quotes_total = db.execute(select(func.count()).select_from(EventQuote).where(EventQuote.event_id == event_id)).scalar_one()
    quotes = db.execute(
        select(EventQuote).where(EventQuote.event_id == event_id).limit(CAP_QUOTES)
    ).scalars().all()

    evidence_total = db.execute(select(func.count()).select_from(EventEvidence).where(EventEvidence.event_id == event_id)).scalar_one()
    evidence = db.execute(
        select(EventEvidence).where(EventEvidence.event_id == event_id).limit(CAP_EVIDENCE)
    ).scalars().all()

    links_total = db.execute(
        select(func.count()).select_from(EventLinkedArticle).where(EventLinkedArticle.event_id == event_id)
    ).scalar_one()
    links = db.execute(
        select(EventLinkedArticle)
        .where(EventLinkedArticle.event_id == event_id)
        .order_by(EventLinkedArticle.publication_date)
        .limit(CAP_LINKED_ARTICLES)
    ).scalars().all()

    return EventDetailOut(
        **_to_summary(e, categories).model_dump(),
        cause_summary=e.cause_summary,
        cause_alt_summaries=_loads(e.cause_alt_summaries_json),
        protesting_for=_loads(e.protesting_for_json),
        protesting_against=_loads(e.protesting_against_json),
        publications=_loads(e.publications_json),
        locations=locations_out,
        numbers=numbers_out,
        participants=participants_out,
        policing_activities=[ActivityOut(description=p.description, article_ids=_loads(p.article_ids_json)) for p in policing],
        legal_outcomes=[ActivityOut(description=l.description, article_ids=_loads(l.article_ids_json)) for l in legal],
        quotes=[
            QuoteOut(
                document_id=qt.document_id, speaker_name=qt.speaker_name, speaker_organisation=qt.speaker_organisation,
                speaker_type=qt.speaker_type, stance_toward_protest=qt.stance_toward_protest, text=qt.text, word_count=qt.word_count,
            )
            for qt in quotes
        ],
        quotes_total_count=quotes_total,
        evidence=[
            EvidenceUnitOut(document_id=ev.document_id, text=ev.text, fields=_loads(ev.fields_json)) for ev in evidence
        ],
        evidence_total_count=evidence_total,
        linked_articles=[
            LinkedArticleOut(
                document_id=la.document_id, headline=la.headline, byline=la.byline, publication=la.publication,
                publication_date=la.publication_date, section=la.section, page=la.page, word_count=la.word_count,
                source_year=la.source_year, framing=la.framing, framing_reason=la.framing_reason,
                relevance_category=la.relevance_category, relevance_status=la.relevance_status,
                relevance_reason=la.relevance_reason,
            )
            for la in links
        ],
        linked_articles_total_count=links_total,
    )


def _build_numbers(db: Session, event_id: str) -> NumbersOut:
    rows = db.execute(select(EventNumber).where(EventNumber.event_id == event_id)).scalars().all()
    by_type: dict[str, list[EventNumber]] = defaultdict(list)
    for r in rows:
        by_type[r.number_type].append(r)

    def group(number_type: str) -> NumberGroupOut:
        type_rows = by_type.get(number_type, [])
        seen: set[str] = set()
        deduped: list[NumberEstimateOut] = []
        for r in type_rows:
            key = r.value_text.strip().lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(NumberEstimateOut(value_text=r.value_text, article_ids=_loads(r.article_ids_json)))
            if len(deduped) >= CAP_NUMBERS_PER_TYPE:
                break
        return NumberGroupOut(items=deduped, total_count=len(type_rows))

    return NumbersOut(crowd=group("crowd"), arrest=group("arrest"), charged=group("charged"), injury=group("injury"))


def _build_participants(db: Session, event_id: str) -> ParticipantsOut:
    rows = db.execute(select(EventParticipant).where(EventParticipant.event_id == event_id)).scalars().all()
    by_side: dict[str, list[EventParticipant]] = defaultdict(list)
    for r in rows:
        by_side[r.side].append(r)

    def group(side: str) -> ParticipantGroupOut:
        side_rows = by_side.get(side, [])
        items = [
            ParticipantOut(
                name_or_description=r.name_or_description, roles=_loads(r.roles_json),
                organisations=_loads(r.organisations_json), quoted=r.quoted, article_ids=_loads(r.article_ids_json),
            )
            for r in side_rows[:CAP_PARTICIPANTS_PER_SIDE]
        ]
        return ParticipantGroupOut(items=items, total_count=len(side_rows))

    return ParticipantsOut(
        protest_groups=group("protest_group"),
        protest_spokespeople=group("protest_spokesperson"),
        authority_orgs=group("authority_org"),
        authority_spokespeople=group("authority_spokesperson"),
    )
