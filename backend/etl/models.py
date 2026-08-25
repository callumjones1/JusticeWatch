"""SQLAlchemy ORM models for the pre-clustered protest-events dataset.

Source: protest_events_dataset.json, produced by an external pipeline
(build_timeline_data.py) that already consolidates article-level protest
mentions into events -- no clustering happens on our side. Each `events`
row is one real-world protest; every child table hangs off `event_id` and
holds data already merged across that event's linked articles.
"""

from __future__ import annotations

from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_date_start", "date_start"),
        Index("ix_events_primary_state", "primary_state"),
        Index("ix_events_status", "status"),
    )

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title_core: Mapped[str | None] = mapped_column(Text)
    display_title: Mapped[str] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(50))

    # Not always a clean 10-char YYYY-MM-DD -- some source dates are full ISO
    # datetimes ("2007-09-05T13:30:00", 19 chars). SQLite let this through
    # silently (untyped); Postgres correctly rejected it as a truncation
    # error, which is how this was caught. Text rather than a wider fixed
    # bound since these come from free-text LLM date extraction, not a
    # controlled format.
    date_start: Mapped[str | None] = mapped_column(Text)
    date_end: Mapped[str | None] = mapped_column(Text)
    date_precision: Mapped[str | None] = mapped_column(String(30))
    date_reported_text: Mapped[str | None] = mapped_column(Text)
    date_basis: Mapped[str | None] = mapped_column(String(30))
    date_year: Mapped[int | None] = mapped_column(Integer)

    cause_summary: Mapped[str | None] = mapped_column(Text)
    cause_alt_summaries_json: Mapped[str | None] = mapped_column(Text)
    protesting_for_json: Mapped[str | None] = mapped_column(Text)
    protesting_against_json: Mapped[str | None] = mapped_column(Text)

    article_count: Mapped[int] = mapped_column(Integer, default=0)
    coded_mention_count: Mapped[int] = mapped_column(Integer, default=0)
    framing: Mapped[str | None] = mapped_column(String(30))
    framing_breakdown_json: Mapped[str | None] = mapped_column(Text)
    publications_json: Mapped[str | None] = mapped_column(Text)

    flag_arrest: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_court: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_force: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_legal: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_policing: Mapped[bool] = mapped_column(Boolean, default=False)

    primary_state: Mapped[str | None] = mapped_column(String(100))
    primary_city: Mapped[str | None] = mapped_column(String(200))

    quote_count: Mapped[int] = mapped_column(Integer, default=0)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0)

    issue_categories: Mapped[list["EventIssueCategory"]] = relationship(cascade="all, delete-orphan")
    locations: Mapped[list["EventLocation"]] = relationship(cascade="all, delete-orphan")
    numbers: Mapped[list["EventNumber"]] = relationship(cascade="all, delete-orphan")
    participants: Mapped[list["EventParticipant"]] = relationship(cascade="all, delete-orphan")
    policing_activities: Mapped[list["EventPolicingActivity"]] = relationship(cascade="all, delete-orphan")
    legal_outcomes: Mapped[list["EventLegalOutcome"]] = relationship(cascade="all, delete-orphan")
    evidence: Mapped[list["EventEvidence"]] = relationship(cascade="all, delete-orphan")
    quotes: Mapped[list["EventQuote"]] = relationship(cascade="all, delete-orphan")
    reported_dates: Mapped[list["EventReportedDate"]] = relationship(cascade="all, delete-orphan")
    reported_statuses: Mapped[list["EventReportedStatus"]] = relationship(cascade="all, delete-orphan")
    linked_articles: Mapped[list["EventLinkedArticle"]] = relationship(cascade="all, delete-orphan")


class EventIssueCategory(Base):
    __tablename__ = "event_issue_categories"
    __table_args__ = (
        Index("ix_eic_event_id", "event_id"),
        Index("ix_eic_category", "category"),
        Index("ix_eic_group_key", "group_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(200))
    # Normalized grouping key (first significant word, see etl/text_grouping.py)
    # so near-duplicate free-text categories like "5G", "5G conspiracy
    # claims", "5G infrastructure" collapse into one facet/tag instead of
    # dozens of near-identical entries.
    group_key: Mapped[str] = mapped_column(String(200))


class EventLocation(Base):
    __tablename__ = "event_locations"
    __table_args__ = (Index("ix_el_event_id", "event_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    location_index: Mapped[int] = mapped_column(Integer)
    venue: Mapped[str | None] = mapped_column(String(300))
    city: Mapped[str | None] = mapped_column(String(200))
    state_or_territory: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    precision: Mapped[str | None] = mapped_column(String(20))
    article_ids_json: Mapped[str | None] = mapped_column(Text)


class EventNumber(Base):
    """Flattens numbers.{crowdEstimates,arrestCounts,chargedCounts,injuryCounts}."""

    __tablename__ = "event_numbers"
    __table_args__ = (Index("ix_en_event_id", "event_id"), Index("ix_en_type", "number_type"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    number_type: Mapped[str] = mapped_column(String(20))  # crowd | arrest | charged | injury
    value_text: Mapped[str] = mapped_column(Text)
    article_ids_json: Mapped[str | None] = mapped_column(Text)


class EventParticipant(Base):
    """Flattens participants.{protestGroups,protestSpokespeople,
    policeAndGovernmentOrganisations,policeAndGovernmentSpokespeople}."""

    __tablename__ = "event_participants"
    __table_args__ = (Index("ix_ep_event_id", "event_id"), Index("ix_ep_side", "side"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    side: Mapped[str] = mapped_column(String(30))  # protest_group | protest_spokesperson | authority_org | authority_spokesperson
    name_or_description: Mapped[str] = mapped_column(Text)
    roles_json: Mapped[str | None] = mapped_column(Text)
    organisations_json: Mapped[str | None] = mapped_column(Text)
    quoted: Mapped[bool | None] = mapped_column(Boolean)
    article_ids_json: Mapped[str | None] = mapped_column(Text)


class EventPolicingActivity(Base):
    __tablename__ = "event_policing_activities"
    __table_args__ = (Index("ix_epa_event_id", "event_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(Text)
    article_ids_json: Mapped[str | None] = mapped_column(Text)


class EventLegalOutcome(Base):
    __tablename__ = "event_legal_outcomes"
    __table_args__ = (Index("ix_elo_event_id", "event_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(Text)
    article_ids_json: Mapped[str | None] = mapped_column(Text)


class EventEvidence(Base):
    __tablename__ = "event_evidence"
    __table_args__ = (Index("ix_ee_event_id", "event_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    document_id: Mapped[str | None] = mapped_column(String(128))
    unit_id: Mapped[int | None] = mapped_column(Integer)
    start_character: Mapped[int | None] = mapped_column(Integer)
    end_character: Mapped[int | None] = mapped_column(Integer)
    text: Mapped[str | None] = mapped_column(Text)
    fields_json: Mapped[str | None] = mapped_column(Text)


class EventQuote(Base):
    __tablename__ = "event_quotes"
    __table_args__ = (Index("ix_eq_event_id", "event_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    document_id: Mapped[str | None] = mapped_column(String(128))
    quote_id: Mapped[int | None] = mapped_column(Integer)
    speaker_name: Mapped[str | None] = mapped_column(String(300))
    speaker_organisation: Mapped[str | None] = mapped_column(String(300))
    speaker_type: Mapped[str | None] = mapped_column(String(50))
    stance_toward_protest: Mapped[str | None] = mapped_column(String(50))
    text: Mapped[str | None] = mapped_column(Text)
    word_count: Mapped[int | None] = mapped_column(Integer)
    start_character: Mapped[int | None] = mapped_column(Integer)
    end_character: Mapped[int | None] = mapped_column(Integer)
    assignment_basis_json: Mapped[str | None] = mapped_column(Text)


class EventReportedDate(Base):
    __tablename__ = "event_reported_dates"
    __table_args__ = (Index("ix_erd_event_id", "event_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    start_date: Mapped[str | None] = mapped_column(Text)  # see Event.date_start
    end_date: Mapped[str | None] = mapped_column(Text)
    precision: Mapped[str | None] = mapped_column(String(30))
    reported_text: Mapped[str | None] = mapped_column(Text)
    article_ids_json: Mapped[str | None] = mapped_column(Text)


class EventReportedStatus(Base):
    __tablename__ = "event_reported_statuses"
    __table_args__ = (Index("ix_ers_event_id", "event_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    value: Mapped[str | None] = mapped_column(String(50))
    article_ids_json: Mapped[str | None] = mapped_column(Text)


class EventLinkedArticle(Base):
    __tablename__ = "event_linked_articles"
    __table_args__ = (
        Index("ix_ela_event_id", "event_id"),
        Index("ix_ela_document_id", "document_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id", ondelete="CASCADE"))
    document_id: Mapped[str] = mapped_column(String(128))
    headline: Mapped[str | None] = mapped_column(Text)
    byline: Mapped[str | None] = mapped_column(Text)
    publication: Mapped[str | None] = mapped_column(String(300))
    publication_date: Mapped[str | None] = mapped_column(String(10))
    publication_time: Mapped[str | None] = mapped_column(String(20))
    # Text not a bounded width -- some source records have raw Factiva RTF
    # hyperlink artifacts leaked into this field (up to 700+ chars).
    section: Mapped[str | None] = mapped_column(Text)
    page: Mapped[str | None] = mapped_column(String(50))
    edition: Mapped[str | None] = mapped_column(String(100))
    word_count: Mapped[int | None] = mapped_column(Integer)
    source_code: Mapped[str | None] = mapped_column(String(50))
    source_year: Mapped[int | None] = mapped_column(Integer)
    source_relative_path: Mapped[str | None] = mapped_column(Text)

    framing: Mapped[str | None] = mapped_column(String(30))
    framing_confidence: Mapped[float | None] = mapped_column(Float)
    framing_reason: Mapped[str | None] = mapped_column(Text)

    relevance: Mapped[bool | None] = mapped_column(Boolean)
    relevance_category: Mapped[str | None] = mapped_column(String(100))
    relevance_confidence: Mapped[float | None] = mapped_column(Float)
    relevance_status: Mapped[str | None] = mapped_column(String(50))
    relevance_reason: Mapped[str | None] = mapped_column(Text)

    quote_metrics_json: Mapped[str | None] = mapped_column(Text)
    protest_record_ids_json: Mapped[str | None] = mapped_column(Text)
    evidence_unit_ids_json: Mapped[str | None] = mapped_column(Text)
    assigned_quote_ids_json: Mapped[str | None] = mapped_column(Text)
