import { useState, useMemo } from 'react';
import data from '../data/legislation_tracker.json';

type Entry = {
  id: string;
  jurisdiction: string;
  short_title: string;
  full_title: string;
  year: number;
  amended?: number;
  url: string;
  status?: string;
  key_provisions: string[];
  commentary: string;
  tags: string[];
  related_cases: string[];
};

type Category = {
  id: string;
  label: string;
  description: string;
  entries: Entry[];
};

type Theme = {
  id: string;
  title: string;
  summary: string;
};

const categories = data.categories as Category[];
const themes = data.themes as Theme[];

const ALL_JURISDICTIONS = ['All', ...Array.from(new Set(categories.flatMap(c => c.entries.map(e => e.jurisdiction)))).sort()];
const ALL_TAGS = Array.from(new Set(categories.flatMap(c => c.entries.flatMap(e => e.tags)))).sort();

export default function LegislationTracker() {
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['anti-protest']));
  const [openEntries, setOpenEntries] = useState<Set<string>>(new Set());
  const [filterJur, setFilterJur] = useState('All');
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [showThemes, setShowThemes] = useState(true);

  function toggleCat(id: string) {
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleEntry(id: string) {
    setOpenEntries(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTag(tag: string) {
    setFilterTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function clearFilters() {
    setFilterJur('All');
    setFilterTags(new Set());
    setActiveTheme(null);
  }

  function activateTheme(theme: Theme) {
    if (activeTheme === theme.id) {
      setActiveTheme(null);
      setFilterTags(new Set());
    } else {
      setActiveTheme(theme.id);
      // Use theme id as a tag proxy — highlight entries sharing any of the theme's related tags
      // We find entries that mention the theme id or have tags that overlap with theme key terms
      const themeTagKeywords = theme.id.split('-');
      const matchingTags = ALL_TAGS.filter(t => themeTagKeywords.some(k => t.includes(k)));
      setFilterTags(new Set(matchingTags.length ? matchingTags : [theme.id]));
    }
  }

  const matchesFilters = useMemo(() => (entry: Entry) => {
    if (filterJur !== 'All' && entry.jurisdiction !== filterJur) return false;
    if (filterTags.size > 0 && !entry.tags.some(t => filterTags.has(t))) return false;
    return true;
  }, [filterJur, filterTags]);

  const hasActiveFilter = filterJur !== 'All' || filterTags.size > 0;

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Legislation Tracker</h1>
          <p className="page-subtitle">{data.metadata.subtitle}</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <p className="db-note" style={{ textAlign: 'left', marginBottom: '1.25rem', marginTop: 0 }}>
            {data.metadata.description}
          </p>

          {/* Filter bar */}
          <div className="leg-filter-bar">
            <div className="leg-filter-group">
              <span className="leg-filter-label">Jurisdiction</span>
              {ALL_JURISDICTIONS.map(j => (
                <button
                  key={j}
                  className={`leg-pill${filterJur === j ? ' leg-pill-active' : ''}`}
                  onClick={() => setFilterJur(j)}
                >
                  {j}
                </button>
              ))}
            </div>
            {ALL_TAGS.length > 0 && (
              <div className="leg-filter-group" style={{ marginTop: '0.5rem', flexBasis: '100%' }}>
                <span className="leg-filter-label">Tags</span>
                {ALL_TAGS.map(t => (
                  <button
                    key={t}
                    className={`leg-pill${filterTags.has(t) ? ' leg-pill-active' : ''}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            {hasActiveFilter && (
              <button className="leg-pill" onClick={clearFilters} style={{ marginLeft: 'auto' }}>
                Clear filters ×
              </button>
            )}
          </div>

          <div className="leg-layout">
            <div className="leg-main">
              <div className="leg-categories">
                {categories.map(cat => {
                  const isOpen = openCats.has(cat.id);
                  const visibleCount = cat.entries.filter(e => matchesFilters(e)).length;
                  return (
                    <div key={cat.id} className={`leg-cat-card${isOpen ? ' leg-cat-open' : ''}`}>
                      <div className="leg-cat-header" onClick={() => toggleCat(cat.id)}>
                        <div>
                          <div className="leg-cat-title">{cat.label}</div>
                          <div className="leg-cat-desc">{cat.description}</div>
                        </div>
                        <div className="leg-cat-meta">
                          <span className="leg-cat-count">
                            {hasActiveFilter ? `${visibleCount} / ` : ''}{cat.entries.length} entries
                          </span>
                          <svg className="leg-cat-caret" width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="leg-entries">
                          {cat.entries.map(entry => {
                            const matches = matchesFilters(entry);
                            const isEntryOpen = openEntries.has(entry.id);
                            return (
                              <div
                                key={entry.id}
                                className={`leg-entry${isEntryOpen ? ' leg-entry-open' : ''}${!matches && hasActiveFilter ? ' leg-entry-dimmed' : ''}`}
                              >
                                <div className="leg-entry-header" onClick={() => toggleEntry(entry.id)}>
                                  <div>
                                    <div className="leg-entry-jur">{entry.jurisdiction}</div>
                                    <div className="leg-entry-title">
                                      {entry.short_title}
                                      {entry.status && (
                                        <span className="leg-status-badge">{entry.status}</span>
                                      )}
                                    </div>
                                    <div className="leg-entry-year">
                                      {entry.year}{entry.amended ? `, amended ${entry.amended}` : ''}
                                    </div>
                                  </div>
                                  <svg className="leg-entry-caret" width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>

                                {isEntryOpen && (
                                  <div className="leg-entry-body">
                                    <h4>Full title</h4>
                                    <p>
                                      <a href={entry.url} target="_blank" rel="noopener noreferrer">
                                        {entry.full_title} ↗
                                      </a>
                                    </p>

                                    <h4>Key provisions</h4>
                                    <ul>
                                      {entry.key_provisions.map((p, i) => (
                                        <li key={i}>{p}</li>
                                      ))}
                                    </ul>

                                    <h4>Commentary</h4>
                                    <p>{entry.commentary}</p>

                                    {entry.tags.length > 0 && (
                                      <>
                                        <h4>Tags</h4>
                                        <div className="leg-tags">
                                          {entry.tags.map(t => (
                                            <span key={t} className="leg-tag">{t}</span>
                                          ))}
                                        </div>
                                      </>
                                    )}

                                    {entry.related_cases.length > 0 && (
                                      <>
                                        <h4>Related cases</h4>
                                        <div className="leg-related-cases">
                                          {entry.related_cases.map(c => (
                                            <span key={c} className="leg-case-pill" title="Case Studies database coming soon">{c}</span>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Themes panel */}
            <div className="leg-themes-panel">
              <button className="leg-themes-toggle" onClick={() => setShowThemes(v => !v)}>
                {showThemes ? '▾' : '▸'} Themes
              </button>
              {showThemes && (
                <div className="leg-themes-box">
                  <h3>Cross-cutting themes</h3>
                  {themes.map(theme => (
                    <div
                      key={theme.id}
                      className="leg-theme-item"
                      onClick={() => activateTheme(theme)}
                      style={{ borderLeft: activeTheme === theme.id ? '3px solid var(--color-accent)' : '3px solid transparent', paddingLeft: '0.5rem' }}
                    >
                      <div className="leg-theme-title">{theme.title}</div>
                      <div className="leg-theme-summary">{theme.summary}</div>
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
