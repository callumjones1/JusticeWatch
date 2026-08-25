"""Pydantic response models for the events API. Read-only / output only."""

from __future__ import annotations

from pydantic import BaseModel


class LocationOut(BaseModel):
    venue: str | None
    city: str | None
    state_or_territory: str | None
    country: str | None
    precision: str | None
    article_ids: list[str]


class NumberEstimateOut(BaseModel):
    value_text: str
    article_ids: list[str]


class NumberGroupOut(BaseModel):
    items: list[NumberEstimateOut]
    total_count: int


class NumbersOut(BaseModel):
    crowd: NumberGroupOut
    arrest: NumberGroupOut
    charged: NumberGroupOut
    injury: NumberGroupOut


class ParticipantOut(BaseModel):
    name_or_description: str
    roles: list[str]
    organisations: list[str]
    quoted: bool | None
    article_ids: list[str]


class ParticipantGroupOut(BaseModel):
    items: list[ParticipantOut]
    total_count: int


class ParticipantsOut(BaseModel):
    protest_groups: ParticipantGroupOut
    protest_spokespeople: ParticipantGroupOut
    authority_orgs: ParticipantGroupOut
    authority_spokespeople: ParticipantGroupOut


class ActivityOut(BaseModel):
    description: str
    article_ids: list[str]


class EvidenceUnitOut(BaseModel):
    document_id: str | None
    text: str | None
    fields: list[str]


class QuoteOut(BaseModel):
    document_id: str | None
    speaker_name: str | None
    speaker_organisation: str | None
    speaker_type: str | None
    stance_toward_protest: str | None
    text: str | None
    word_count: int | None


class LinkedArticleOut(BaseModel):
    document_id: str
    headline: str | None
    byline: str | None
    publication: str | None
    publication_date: str | None
    section: str | None
    page: str | None
    word_count: int | None
    source_year: int | None
    framing: str | None
    framing_reason: str | None
    relevance_category: str | None
    relevance_status: str | None
    relevance_reason: str | None


class CategoryFacetOut(BaseModel):
    key: str
    label: str
    event_count: int


class EventFlagsOut(BaseModel):
    arrest: bool
    court: bool
    force: bool
    legal: bool
    policing: bool


class EventSummaryOut(BaseModel):
    event_id: str
    display_title: str
    title_core: str | None
    status: str | None
    date_start: str | None
    date_end: str | None
    date_precision: str | None
    date_reported_text: str | None
    primary_state: str | None
    primary_city: str | None
    article_count: int
    quote_count: int
    evidence_count: int
    issue_categories: list[str]
    flags: EventFlagsOut


class EventDetailOut(EventSummaryOut):
    cause_summary: str | None
    cause_alt_summaries: list[str]
    protesting_for: list[str]
    protesting_against: list[str]
    publications: list[str]

    locations: list[LocationOut]
    numbers: NumbersOut
    participants: ParticipantsOut
    policing_activities: list[ActivityOut]
    legal_outcomes: list[ActivityOut]

    quotes: list[QuoteOut]
    quotes_total_count: int
    evidence: list[EvidenceUnitOut]
    evidence_total_count: int
    linked_articles: list[LinkedArticleOut]
    linked_articles_total_count: int


class PaginatedEvents(BaseModel):
    items: list[EventSummaryOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class FacetsOut(BaseModel):
    states: list[str]
    categories: list[CategoryFacetOut]
    statuses: list[str]
    year_min: int | None
    year_max: int | None
