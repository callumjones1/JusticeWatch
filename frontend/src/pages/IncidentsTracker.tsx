import { useState, useMemo } from 'react';
import data from '../data/incidents_tracker.json';

type Source = {
  type: string;
  title: string;
  url: string;
  summary: string;
};

type Incident = {
  id: string;
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

type Theme = {
  id: string;
  title: string;
  summary: string;
};

const incidents = data.incidents as Incident[];
const themes = (data as { themes?: Theme[] }).themes ?? [];

const ALL_YEARS = [...new Set(incidents.map(i => i.year))].sort();
const MIN_YEAR = ALL_YEARS[0];
const MAX_YEAR = ALL_YEARS[ALL_YEARS.length - 1];
const ALL_CATS = [...new Set(incidents.flatMap(i => i.categories))].sort();

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
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());
  const [filterCats, setFilterCats] = useState<Set<string>>(new Set());
  const [yearFrom, setYearFrom] = useState(MIN_YEAR);
  const [yearTo, setYearTo] = useState(MAX_YEAR);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [showThemes, setShowThemes] = useState(true);

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

  function activateTheme(theme: Theme) {
    if (activeTheme === theme.id) {
      setActiveTheme(null);
      setFilterCats(new Set());
    } else {
      setActiveTheme(theme.id);
      // Map theme to relevant categories
      const keywords = theme.id.split('-');
      const matchingCats = ALL_CATS.filter(c => keywords.some(k => c.includes(k)));
      setFilterCats(new Set(matchingCats.length ? matchingCats : [theme.id]));
    }
  }

  function clearFilters() {
    setFilterCats(new Set());
    setYearFrom(MIN_YEAR);
    setYearTo(MAX_YEAR);
    setActiveTheme(null);
  }

  const hasFilter = filterCats.size > 0 || yearFrom !== MIN_YEAR || yearTo !== MAX_YEAR;

  const matchesFilters = useMemo(() => (inc: Incident) => {
    if (inc.year < yearFrom || inc.year > yearTo) return false;
    if (filterCats.size > 0 && !inc.categories.some(c => filterCats.has(c))) return false;
    return true;
  }, [filterCats, yearFrom, yearTo]);

  // Get all years that have incidents in the year range (for markers)
  const yearGroups = useMemo(() => groupByYear(incidents), []);
  const yearsWithIncidents = ALL_YEARS.filter(y => y >= yearFrom && y <= yearTo);

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
          <p className="db-note" style={{ textAlign: 'left', marginBottom: '1.25rem', marginTop: 0 }}>
            {data.metadata.description}
          </p>

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

          <div className="inc-layout">
            <div className="inc-main">
              <div className="inc-timeline">
                {yearsWithIncidents.length === 0 && (
                  <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '2rem 0' }}>
                    No incidents match the current filters.
                  </p>
                )}
                {yearsWithIncidents.map(year => {
                  const yearIncidents = (yearGroups[year] || []);
                  return (
                    <div key={year}>
                      <div className="inc-year-marker">
                        <span className="inc-year-label">{year}</span>
                      </div>
                      {yearIncidents.map(inc => {
                        const matches = matchesFilters(inc);
                        const isOpen = openNodes.has(inc.id);
                        return (
                          <div
                            key={inc.id}
                            className={`inc-node${isOpen ? ' inc-node-active' : ''}${!matches && hasFilter ? ' inc-node-dimmed' : ''}`}
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
                                          <span key={i} className="inc-link-pill" title="See Case Studies database">
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

            {/* Themes panel */}
            <div className="inc-themes-panel">
              <button className="inc-themes-toggle" onClick={() => setShowThemes(v => !v)}>
                {showThemes ? '▾' : '▸'} Themes
              </button>
              {showThemes && (
                <div className="inc-themes-box">
                  <h3>Cross-cutting themes</h3>
                  {themes.map(theme => (
                    <div
                      key={theme.id}
                      className="inc-theme-item"
                      onClick={() => activateTheme(theme)}
                      style={{ borderLeft: activeTheme === theme.id ? '3px solid var(--color-accent)' : '3px solid transparent', paddingLeft: '0.5rem' }}
                    >
                      <div className="inc-theme-title">{theme.title}</div>
                      <div className="inc-theme-summary">{theme.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="db-note">{data.metadata.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
