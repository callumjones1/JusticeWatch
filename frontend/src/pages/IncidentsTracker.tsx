import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import data from '../data/incidents_tracker.json';

type Source = {
  type: string;
  title: string;
  url: string;
  summary: string;
};

type IncidentType = 'protest' | 'political_violence';

type Incident = {
  id: string;
  incident_type: IncidentType;
  title: string;
  short_title: string;
  date_start: string;
  date_end: string | null;
  date_display: string;
  year: number;
  location: string;
  categories: string[];
  summary: string;
  legislative_links: string[];
  related_cases: string[];
  sources: Source[];
};

const incidents = data.incidents as Incident[];

const SPLIT_TABS: { key: IncidentType; label: string }[] = [
  { key: 'protest', label: 'Protest Events' },
  { key: 'political_violence', label: 'Political Violence' },
];

const ALL_YEARS = [...new Set(incidents.map(i => i.year))].sort();
const MIN_YEAR = ALL_YEARS[0];
const MAX_YEAR = ALL_YEARS[ALL_YEARS.length - 1];

function srcBadgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('government') || t.includes('official') || t.includes('police') || t.includes('museum')) return 'src-badge src-government';
  if (t.includes('civil society') || t.includes('ngo') || t.includes('amnesty') || t.includes('liberty') || t.includes('rights')) return 'src-badge src-civil-society';
  if (t.includes('academic') || t.includes('research') || t.includes('historical')) return 'src-badge src-academic';
  if (t.includes('media') || t.includes('news') || t.includes('analysis')) return 'src-badge src-media';
  if (t.includes('international') || t.includes('un ') || t.includes('united nations')) return 'src-badge src-international';
  if (t.includes('legal') || t.includes('court') || t.includes('tribunal')) return 'src-badge src-legal';
  return 'src-badge src-default';
}

function srcLabel(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('government') || t.includes('official') || t.includes('police')) return 'Government';
  if (t.includes('civil society') || t.includes('ngo') || t.includes('rights')) return 'Civil Society';
  if (t.includes('academic') || t.includes('research') || t.includes('historical')) return 'Academic';
  if (t.includes('media') || t.includes('news')) return 'Media';
  if (t.includes('international') || t.includes('un ')) return 'International';
  if (t.includes('legal') || t.includes('court')) return 'Legal';
  return type;
}

// Group incidents by year for the timeline
function groupByYear(list: Incident[]) {
  const map: Record<number, Incident[]> = {};
  for (const inc of list) {
    if (!map[inc.year]) map[inc.year] = [];
    map[inc.year].push(inc);
  }
  return map;
}

export default function IncidentsTracker() {
  const [split, setSplit] = useState<IncidentType>('protest');
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());
  const [filterCats, setFilterCats] = useState<Set<string>>(new Set());
  const [yearFrom, setYearFrom] = useState(MIN_YEAR);
  const [yearTo, setYearTo] = useState(MAX_YEAR);

  const splitIncidents = useMemo(() => incidents.filter(i => i.incident_type === split), [split]);
  const ALL_CATS = useMemo(() => [...new Set(splitIncidents.flatMap(i => i.categories))].sort(), [splitIncidents]);

  function selectSplit(next: IncidentType) {
    setSplit(next);
    setFilterCats(new Set());
  }

  function toggleNode(id: string) {
    setOpenNodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCat(cat: string) {
    setFilterCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  function clearFilters() {
    setFilterCats(new Set());
    setYearFrom(MIN_YEAR);
    setYearTo(MAX_YEAR);
  }

  const hasFilter = filterCats.size > 0 || yearFrom !== MIN_YEAR || yearTo !== MAX_YEAR;

  const matchesFilters = useMemo(() => (inc: Incident) => {
    if (inc.year < yearFrom || inc.year > yearTo) return false;
    if (filterCats.size > 0 && !inc.categories.some(c => filterCats.has(c))) return false;
    return true;
  }, [filterCats, yearFrom, yearTo]);

  // Filter incidents and group by year for the timeline
  const filteredIncidents = useMemo(
    () => splitIncidents.filter(matchesFilters),
    [splitIncidents, matchesFilters]
  );
  const yearGroups = useMemo(() => groupByYear(filteredIncidents), [filteredIncidents]);
  const yearsWithIncidents = ALL_YEARS.filter(y => yearGroups[y]?.length > 0);

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Incidents Tracker</h1>
          <p className="page-subtitle">{data.metadata.subtitle}</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <p className="db-note" style={{ textAlign: 'left', marginBottom: '0.75rem', marginTop: 0 }}>
            {data.metadata.description}
          </p>
          <p className="db-note" style={{ textAlign: 'left', marginBottom: '1.25rem', marginTop: 0 }}>
            {data.metadata.disclaimer}
          </p>

          {/* Protest / political violence split */}
          <div className="inc-view-toggle">
            {SPLIT_TABS.map(tab => (
              <button
                key={tab.key}
                className={`inc-view-tab${split === tab.key ? ' inc-view-tab-active' : ''}`}
                onClick={() => selectSplit(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="inc-filter-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%' }}>
              <span className="leg-filter-label">Year range</span>
              <div className="inc-year-range">
                <span>{yearFrom}</span>
                <input
                  type="range"
                  min={MIN_YEAR}
                  max={MAX_YEAR}
                  value={yearFrom}
                  onChange={e => setYearFrom(Math.min(Number(e.target.value), yearTo))}
                />
                <input
                  type="range"
                  min={MIN_YEAR}
                  max={MAX_YEAR}
                  value={yearTo}
                  onChange={e => setYearTo(Math.max(Number(e.target.value), yearFrom))}
                />
                <span>{yearTo}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', width: '100%' }}>
              <span className="leg-filter-label">Category</span>
              {ALL_CATS.map(cat => (
                <button
                  key={cat}
                  className={`leg-pill${filterCats.has(cat) ? ' leg-pill-active' : ''}`}
                  onClick={() => toggleCat(cat)}
                >
                  {cat}
                </button>
              ))}
              {hasFilter && (
                <button className="leg-pill" onClick={clearFilters} style={{ marginLeft: 'auto' }}>
                  Clear ×
                </button>
              )}
            </div>
          </div>

          <div className="inc-main">
              <div className="inc-timeline">
                {yearsWithIncidents.length === 0 && (
                  <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '2rem 0' }}>
                    No incidents match the current filters.
                  </p>
                )}
                {yearsWithIncidents.map(year => {
                  const yearIncidents = yearGroups[year] || [];
                  return (
                    <div key={year}>
                      <div className="inc-year-marker">
                        <span className="inc-year-label">{year}</span>
                      </div>
                      {yearIncidents.map(inc => {
                        const isOpen = openNodes.has(inc.id);
                        return (
                          <div
                            key={inc.id}
                            className={`inc-node${isOpen ? ' inc-node-active' : ''}`}
                          >
                            <div className="inc-node-card">
                              <div className="inc-node-header" onClick={() => toggleNode(inc.id)}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="inc-node-date">
                                    {inc.date_display}
                                    {inc.date_end === null && (
                                      <span className="inc-ongoing-badge">Ongoing</span>
                                    )}
                                  </div>
                                  <div className="inc-node-title">{inc.title}</div>
                                  <div className="inc-node-location">{inc.location}</div>
                                </div>
                                <div className="inc-node-badges">
                                  {inc.categories.slice(0, 3).map(cat => (
                                    <span key={cat} className="inc-cat-badge">{cat}</span>
                                  ))}
                                  {inc.categories.length > 3 && (
                                    <span className="inc-cat-badge">+{inc.categories.length - 3}</span>
                                  )}
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: '0.25rem', transition: 'transform 0.3s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                              </div>

                              {isOpen && (
                                <div className="inc-node-body">
                                  <p className="inc-node-summary">{inc.summary}</p>
                                  <p>
                                    <Link className="db-link" to={`/analytics?focus=${inc.id}`}>View in Analytics ↗</Link>
                                  </p>

                                  {inc.sources.length > 0 && (
                                    <>
                                      <div className="inc-section-label">Sources</div>
                                      <div className="inc-sources-list">
                                        {inc.sources.map((src, i) => (
                                          <div key={i} className="inc-source-item">
                                            <span className={srcBadgeClass(src.type)}>{srcLabel(src.type)}</span>
                                            <div className="inc-source-text">
                                              <a
                                                href={src.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inc-source-title"
                                              >
                                                {src.title} ↗
                                              </a>
                                              {src.summary && (
                                                <div className="inc-source-summary-text">{src.summary}</div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}

                                  {inc.legislative_links.length > 0 && (
                                    <>
                                      <div className="inc-section-label" style={{ marginTop: '1rem' }}>Legislative links</div>
                                      <div className="inc-link-pills">
                                        {inc.legislative_links.map((link, i) => (
                                          <span key={i} className="inc-link-pill" title="See Legislation Tracker">
                                            {link}
                                          </span>
                                        ))}
                                      </div>
                                    </>
                                  )}

                                  {inc.related_cases.length > 0 && (
                                    <>
                                      <div className="inc-section-label" style={{ marginTop: '1rem' }}>Related cases</div>
                                      <div className="inc-link-pills">
                                        {inc.related_cases.map((c, i) => (
                                          <span key={i} className="inc-link-pill" title="See Cases database">
                                            {c}
                                          </span>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
