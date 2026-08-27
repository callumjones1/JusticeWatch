import { useEffect, useMemo, useState } from 'react';
import {
  listEvents,
  getEvent,
  getFacets,
  type EventSummary,
  type EventDetail,
  type Facets,
  type SortBy,
  type SortDir,
} from '../api/events';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

const COLUMNS: { key: SortBy; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'title', label: 'Event' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status' },
  { key: 'articles', label: 'Articles' },
];

const FLAG_OPTIONS: { key: keyof FlagFilterState; label: string }[] = [
  { key: 'arrest', label: 'Arrests' },
  { key: 'court', label: 'Court' },
  { key: 'force', label: 'Force' },
  { key: 'legal', label: 'Legal outcome' },
  { key: 'policing', label: 'Policing activity' },
];

interface FlagFilterState {
  arrest: boolean;
  court: boolean;
  force: boolean;
  legal: boolean;
  policing: boolean;
}

const EMPTY_FLAGS: FlagFilterState = { arrest: false, court: false, force: false, legal: false, policing: false };

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Date unknown';
  if (!end || start === end) return start ?? end ?? 'Date unknown';
  return `${start} – ${end}`;
}

function formatLocation(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(', ') || 'Location unspecified';
}

function formatLabel(value: string | null): string {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ');
}

export default function NewsMediaCoverage() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [facetsError, setFacetsError] = useState<string | null>(null);

  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);
  const [filterState, setFilterState] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFlags, setFilterFlags] = useState<FlagFilterState>(EMPTY_FLAGS);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('articles');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<{ items: EventSummary[]; total: number; total_pages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, EventDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getFacets(controller.signal)
      .then(f => {
        setFacets(f);
        setYearFrom(f.year_min ?? 1850);
        setYearTo(f.year_max ?? new Date().getFullYear());
      })
      .catch(err => {
        if (err.name !== 'AbortError') setFacetsError('Could not load filter options — is the backend running on port 8000?');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (yearFrom === null || yearTo === null) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    listEvents(
      {
        year_from: yearFrom,
        year_to: yearTo,
        state: filterState || undefined,
        category: filterCategory || undefined,
        status: filterStatus || undefined,
        flag_arrest: filterFlags.arrest || undefined,
        flag_court: filterFlags.court || undefined,
        flag_force: filterFlags.force || undefined,
        flag_legal: filterFlags.legal || undefined,
        flag_policing: filterFlags.policing || undefined,
        q: debouncedQ || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        page_size: PAGE_SIZE,
      },
      controller.signal
    )
      .then(res => setData(res))
      .catch(err => {
        if (err.name !== 'AbortError') setError('Could not reach the API — is the backend running on port 8000?');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [yearFrom, yearTo, filterState, filterCategory, filterStatus, filterFlags, debouncedQ, sortBy, sortDir, page]);

  function setYearFromAndResetPage(v: number) { setYearFrom(v); setPage(1); }
  function setYearToAndResetPage(v: number) { setYearTo(v); setPage(1); }
  function setFilterStateAndResetPage(v: string) { setFilterState(v); setPage(1); }
  function setFilterCategoryAndResetPage(v: string) { setFilterCategory(v); setPage(1); }
  function setFilterStatusAndResetPage(v: string) { setFilterStatus(v); setPage(1); }
  function handleSort(col: SortBy) {
    if (sortBy === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir(col === 'title' || col === 'location' || col === 'status' ? 'asc' : 'desc'); }
    setPage(1);
  }
  function toggleFlag(key: keyof FlagFilterState) {
    setFilterFlags(prev => ({ ...prev, [key]: !prev[key] }));
    setPage(1);
  }

  const hasFilter =
    filterState !== '' || filterCategory !== '' || filterStatus !== '' || debouncedQ !== '' ||
    Object.values(filterFlags).some(Boolean) ||
    (facets && yearFrom !== facets.year_min) || (facets && yearTo !== facets.year_max);

  function clearFilters() {
    setFilterState('');
    setFilterCategory('');
    setFilterStatus('');
    setFilterFlags(EMPTY_FLAGS);
    setSearchInput('');
    setDebouncedQ('');
    if (facets) {
      setYearFrom(facets.year_min);
      setYearTo(facets.year_max);
    }
    setPage(1);
  }

  function toggleEvent(id: string) {
    if (openEventId === id) {
      setOpenEventId(null);
      return;
    }
    setOpenEventId(id);
    if (!detailCache[id]) {
      setDetailLoadingId(id);
      setDetailError(null);
      getEvent(id)
        .then(detail => setDetailCache(prev => ({ ...prev, [id]: detail })))
        .catch(() => setDetailError('Could not load event detail.'))
        .finally(() => setDetailLoadingId(null));
    }
  }

  const yearMin = facets?.year_min ?? 1850;
  const yearMax = facets?.year_max ?? new Date().getFullYear();

  const pageSummary = useMemo(() => {
    if (!data) return '';
    if (data.total === 0) return 'No events match the current filters';
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, data.total);
    return `${start.toLocaleString()}–${end.toLocaleString()} of ${data.total.toLocaleString()} events`;
  }, [data, page]);

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>News Media Coverage</h1>
          <p className="page-subtitle">
            {(facets?.year_min ?? '…')}–{(facets?.year_max ?? '…')} · built from news coverage, event-clustered by an
            automated research pipeline
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {facetsError && (
            <div className="db-empty" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
              {facetsError}
            </div>
          )}

          {!facetsError && (
            <>
              <div className="db-toolbar">
                <div className="db-search-wrapper">
                  <span className="db-search-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    className="db-search"
                    type="text"
                    placeholder="Search event titles…"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                  />
                  {searchInput && (
                    <button className="db-search-clear" onClick={() => setSearchInput('')} aria-label="Clear search">
                      ×
                    </button>
                  )}
                </div>
                <span className="db-count">{pageSummary}</span>
              </div>

              <div className="events-filters">
                <div className="events-filter-group">
                  <span className="events-filter-label">Year range</span>
                  <div className="events-year-range">
                    <span>{yearFrom ?? yearMin}</span>
                    <input
                      type="range" min={yearMin} max={yearMax} value={yearFrom ?? yearMin} disabled={!facets}
                      onChange={e => setYearFromAndResetPage(Math.min(Number(e.target.value), yearTo ?? yearMax))}
                    />
                    <input
                      type="range" min={yearMin} max={yearMax} value={yearTo ?? yearMax} disabled={!facets}
                      onChange={e => setYearToAndResetPage(Math.max(Number(e.target.value), yearFrom ?? yearMin))}
                    />
                    <span>{yearTo ?? yearMax}</span>
                  </div>
                </div>

                <div className="events-filter-group">
                  <span className="events-filter-label">State</span>
                  <select className="events-filter-select" value={filterState} disabled={!facets}
                    onChange={e => setFilterStateAndResetPage(e.target.value)}>
                    <option value="">All</option>
                    {facets?.states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="events-filter-group">
                  <span className="events-filter-label">Status</span>
                  <select className="events-filter-select" value={filterStatus} disabled={!facets}
                    onChange={e => setFilterStatusAndResetPage(e.target.value)}>
                    <option value="">All</option>
                    {facets?.statuses.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
                  </select>
                </div>

                <div className="events-filter-group" style={{ flexBasis: '100%' }}>
                  <span className="events-filter-label">Category</span>
                  <select className="events-filter-select" style={{ minWidth: '220px' }} value={filterCategory} disabled={!facets}
                    onChange={e => setFilterCategoryAndResetPage(e.target.value)}>
                    <option value="">All</option>
                    {facets?.categories.map(c => (
                      <option key={c.key} value={c.key}>{c.label} ({c.event_count})</option>
                    ))}
                  </select>
                </div>

                <div className="events-filter-group" style={{ flexBasis: '100%' }}>
                  <span className="events-filter-label">Flags</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {FLAG_OPTIONS.map(f => (
                      <button
                        key={f.key}
                        className={`db-pill${filterFlags[f.key] ? ' db-pill-active' : ''}`}
                        onClick={() => toggleFlag(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                    {hasFilter && (
                      <button className="db-pill" onClick={clearFilters} style={{ marginLeft: '0.5rem' }}>
                        Clear filters ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {error && <div className="db-empty">{error}</div>}

              {!error && (
                <div className="db-table-wrapper" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                  <table className="db-table">
                    <thead>
                      <tr>
                        {COLUMNS.map(col => (
                          <th key={col.key} className="db-th db-th-sortable" onClick={() => handleSort(col.key)}>
                            {col.label}
                            <span className={`sort-icon${sortBy === col.key ? ' sort-icon-active' : ' sort-icon-neutral'}`}>
                              {sortBy === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data && data.items.length === 0 && (
                        <tr><td colSpan={5} className="db-empty">No events match the current filters.</td></tr>
                      )}
                      {data?.items.map(ev => {
                        const isOpen = openEventId === ev.event_id;
                        const detail = detailCache[ev.event_id];
                        return [
                          <tr key={ev.event_id} className="db-row" onClick={() => toggleEvent(ev.event_id)} style={{ cursor: 'pointer' }}>
                            <td className="db-td db-td-muted" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                              {formatDateRange(ev.date_start, ev.date_end)}
                              {ev.date_precision === 'publication_date_fallback' && (
                                <div className="events-fallback-note">unconfirmed date</div>
                              )}
                            </td>
                            <td className="db-td db-td-name">{ev.display_title}</td>
                            <td className="db-td db-td-muted" style={{ fontSize: '0.85rem' }}>
                              {formatLocation(ev.primary_city, ev.primary_state)}
                            </td>
                            <td className="db-td"><span className="events-status-pill">{formatLabel(ev.status)}</span></td>
                            <td className="db-td">
                              <span className={`events-source-badge${ev.article_count <= 1 ? ' events-source-badge-single' : ''}`}>
                                {ev.article_count} {ev.article_count === 1 ? 'article' : 'articles'}
                              </span>
                            </td>
                          </tr>,
                          isOpen && (
                            <tr key={`${ev.event_id}-detail`} className="cases-detail-row">
                              <td colSpan={5}>
                                <EventDetailPanel
                                  detail={detail}
                                  loading={detailLoadingId === ev.event_id}
                                  error={detailError && !detail ? detailError : null}
                                />
                              </td>
                            </tr>
                          ),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {data && data.total_pages > 1 && (
                <div className="events-pagination">
                  <button className="db-pill" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>← Previous</button>
                  <span className="db-count">Page {page} of {data.total_pages}</span>
                  <button className="db-pill" disabled={page >= data.total_pages} onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Show `initial` items from a section; a "+N more" button reveals the rest
 * (toggled via the section's id in `expanded`). Every list in this panel
 * goes through this — some real events have hundreds of near-duplicate
 * category/location strings, so nothing here can render unbounded. */
function sectionState(items: unknown[], id: string, initial: number, expanded: Set<string>) {
  const isExpanded = expanded.has(id);
  const shown = isExpanded ? items.length : Math.min(initial, items.length);
  const remaining = items.length - shown;
  return { shown, remaining, isExpanded };
}

function ExpandToggle({ id, remaining, isExpanded, toggle, moreLabel }: {
  id: string; remaining: number; isExpanded: boolean; toggle: (id: string) => void; moreLabel?: string;
}) {
  if (!isExpanded && remaining <= 0) return null;
  return (
    <button className="db-pill events-expand-btn" onClick={() => toggle(id)}>
      {isExpanded ? 'Show less' : `+${remaining} ${moreLabel ?? 'more'}`}
    </button>
  );
}

function EventDetailPanel({ detail, loading, error }: { detail: EventDetail | undefined; loading: boolean; error: string | null }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (loading) return <div className="events-detail-panel"><p className="events-detail-loading">Loading event detail…</p></div>;
  if (error) return <div className="events-detail-panel"><p className="events-detail-loading">{error}</p></div>;
  if (!detail) return null;

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const participantSections: { id: string; label: string; group: EventDetail['participants']['protest_groups'] }[] = [
    { id: 'p-groups', label: 'Protest groups', group: detail.participants.protest_groups },
    { id: 'p-spokes', label: 'Protest spokespeople', group: detail.participants.protest_spokespeople },
    { id: 'p-auth', label: 'Authorities', group: detail.participants.authority_orgs },
    { id: 'p-auth-spokes', label: 'Authority spokespeople', group: detail.participants.authority_spokespeople },
  ];

  const numberSections: { id: string; label: string; group: EventDetail['numbers']['crowd'] }[] = [
    { id: 'n-crowd', label: 'Crowd estimates', group: detail.numbers.crowd },
    { id: 'n-arrest', label: 'Arrests', group: detail.numbers.arrest },
    { id: 'n-charged', label: 'Charges', group: detail.numbers.charged },
    { id: 'n-injury', label: 'Injuries', group: detail.numbers.injury },
  ];

  const categories = sectionState(detail.issue_categories, 'categories', 10, expanded);
  const locations = sectionState(detail.locations, 'locations', 1, expanded);
  const quotes = sectionState(detail.quotes, 'quotes', 5, expanded);
  const articles = sectionState(detail.linked_articles, 'articles', 5, expanded);
  const policing = sectionState(detail.policing_activities, 'policing', 3, expanded);
  const legal = sectionState(detail.legal_outcomes, 'legal', 3, expanded);

  return (
    <div className="events-detail-panel">
      {detail.issue_categories.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {detail.issue_categories.slice(0, categories.shown).map(c => <span key={c} className="db-tag">{c}</span>)}
          <ExpandToggle id="categories" remaining={categories.remaining} isExpanded={categories.isExpanded} toggle={toggle} />
        </div>
      )}

      {detail.cause_summary && (
        <>
          <h4 className="events-detail-h4">Cause</h4>
          <p className="events-detail-text">{detail.cause_summary}</p>
        </>
      )}
      {detail.cause_alt_summaries.filter(s => s !== detail.cause_summary).length > 0 && (
        <p className="events-detail-note">
          Alternative summaries across sources: {detail.cause_alt_summaries.filter(s => s !== detail.cause_summary).join(' · ')}
        </p>
      )}

      {detail.locations.length > 0 && (
        <>
          <h4 className="events-detail-h4" style={{ marginTop: '1.25rem' }}>
            Locations {detail.locations.length > 1 && `(${detail.locations.length})`}
          </h4>
          <p className="events-detail-text">
            {detail.locations.slice(0, locations.shown).map((l, i) => (
              <span key={i}>
                {[l.venue, l.city, l.state_or_territory].filter(Boolean).join(', ') || 'Unspecified'}
                {i < locations.shown - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
          <ExpandToggle id="locations" remaining={locations.remaining} isExpanded={locations.isExpanded} toggle={toggle} />
        </>
      )}

      <div className="events-two-col">
        {numberSections.filter(s => s.group.items.length > 0).map(s => {
          const sec = sectionState(s.group.items, s.id, 3, expanded);
          const remaining = s.group.total_count - sec.shown;
          return (
            <div key={s.id} className="events-subsection">
              <h4 className="events-detail-h4">{s.label}</h4>
              <ul className="events-plain-list">
                {s.group.items.slice(0, sec.shown).map((n, i) => <li key={i}>{n.value_text}</li>)}
              </ul>
              <ExpandToggle id={s.id} remaining={remaining} isExpanded={sec.isExpanded} toggle={toggle} moreLabel="more reported" />
            </div>
          );
        })}
      </div>

      <div className="events-two-col">
        {participantSections.filter(s => s.group.items.length > 0).map(s => {
          const sec = sectionState(s.group.items, s.id, 3, expanded);
          const remaining = s.group.total_count - sec.shown;
          return (
            <div key={s.id} className="events-subsection">
              <h4 className="events-detail-h4">{s.label}</h4>
              <ul className="events-plain-list">
                {s.group.items.slice(0, sec.shown).map((p, i) => (
                  <li key={i}>
                    {p.name_or_description}
                    {p.roles.length > 0 && <span className="events-detail-note"> — {p.roles.join(', ')}</span>}
                  </li>
                ))}
              </ul>
              <ExpandToggle id={s.id} remaining={remaining} isExpanded={sec.isExpanded} toggle={toggle} />
            </div>
          );
        })}
      </div>

      {(detail.policing_activities.length > 0 || detail.legal_outcomes.length > 0) && (
        <div className="events-two-col">
          {detail.policing_activities.length > 0 && (
            <div className="events-subsection">
              <h4 className="events-detail-h4">Policing activities</h4>
              <ul className="events-plain-list">
                {detail.policing_activities.slice(0, policing.shown).map((a, i) => <li key={i}>{a.description}</li>)}
              </ul>
              <ExpandToggle id="policing" remaining={policing.remaining} isExpanded={policing.isExpanded} toggle={toggle} />
            </div>
          )}
          {detail.legal_outcomes.length > 0 && (
            <div className="events-subsection">
              <h4 className="events-detail-h4">Legal outcomes</h4>
              <ul className="events-plain-list">
                {detail.legal_outcomes.slice(0, legal.shown).map((a, i) => <li key={i}>{a.description}</li>)}
              </ul>
              <ExpandToggle id="legal" remaining={legal.remaining} isExpanded={legal.isExpanded} toggle={toggle} />
            </div>
          )}
        </div>
      )}

      {detail.quotes.length > 0 && (
        <>
          <h4 className="events-detail-h4" style={{ marginTop: '1.25rem' }}>
            Quotes {detail.quotes_total_count > detail.quotes.length && `(${detail.quotes.length} of ${detail.quotes_total_count} fetched)`}
          </h4>
          <div className="events-quotes-list">
            {detail.quotes.slice(0, quotes.shown).map((q, i) => (
              <blockquote key={i} className="events-quote-card">
                <p>&ldquo;{q.text}&rdquo;</p>
                <footer>
                  {q.speaker_name ?? 'Unnamed speaker'}{q.speaker_organisation ? `, ${q.speaker_organisation}` : ''}
                  {q.stance_toward_protest && (
                    <span className={`events-stance events-stance-${q.stance_toward_protest.replace(/_/g, '-')}`}>
                      {q.stance_toward_protest.replace(/_/g, ' ')}
                    </span>
                  )}
                </footer>
              </blockquote>
            ))}
          </div>
          <ExpandToggle id="quotes" remaining={quotes.remaining} isExpanded={quotes.isExpanded} toggle={toggle} />
        </>
      )}

      <h4 className="events-detail-h4" style={{ marginTop: '1.25rem' }}>
        Source articles ({detail.linked_articles_total_count})
      </h4>
      <p className="events-detail-note" style={{ marginBottom: '0.5rem' }}>Click an article for more detail.</p>
      <div className="events-mentions-list">
        {detail.linked_articles.slice(0, articles.shown).map(a => {
          const articleId = `article-${a.document_id}`;
          const isOpen = expanded.has(articleId);
          return (
            <div
              key={a.document_id}
              className="events-mention-card events-mention-card-clickable"
              onClick={() => toggle(articleId)}
            >
              <div className="events-mention-header">
                <span className="events-mention-date">{a.publication_date ?? '—'}</span>
                <span className="events-mention-pub">{a.publication ?? 'Unknown publication'}</span>
              </div>
              <div className="events-mention-headline">{a.headline}</div>
              {isOpen && (
                <div className="events-mention-extra">
                  {a.byline && <div><strong>By:</strong> {a.byline}</div>}
                  {(a.section || a.page) && <div><strong>Section:</strong> {[a.section, a.page && `p. ${a.page}`].filter(Boolean).join(' · ')}</div>}
                  {a.word_count !== null && <div><strong>Length:</strong> {a.word_count} words</div>}
                  {a.framing && (
                    <div>
                      <strong>Framing:</strong> {formatLabel(a.framing)}
                      {a.framing_reason && <span className="events-detail-note"> — {a.framing_reason}</span>}
                    </div>
                  )}
                  {a.relevance_category && (
                    <div>
                      <strong>Relevance:</strong> {formatLabel(a.relevance_category)} ({formatLabel(a.relevance_status)})
                      {a.relevance_reason && <span className="events-detail-note"> — {a.relevance_reason}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ExpandToggle id="articles" remaining={articles.remaining} isExpanded={articles.isExpanded} toggle={toggle} />
      {detail.linked_articles_total_count > detail.linked_articles.length && articles.isExpanded && (
        <p className="events-detail-note">
          {detail.linked_articles.length} of {detail.linked_articles_total_count} total source articles fetched.
        </p>
      )}
    </div>
  );
}
