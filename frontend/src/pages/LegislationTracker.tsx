import { useState, useMemo, type JSX } from 'react';
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

const categories = data.categories as Category[];

const ALL_JURISDICTIONS = ['All', ...Array.from(new Set(categories.flatMap(c => c.entries.map(e => e.jurisdiction)))).sort()];
const ALL_TAGS = Array.from(new Set(categories.flatMap(c => c.entries.flatMap(e => e.tags)))).sort();

const CAT_ACCENT: Record<string, string> = {
  'anti-protest':                 '#dc2626',
  'terrorism-security':           '#1d3a5c',
  'political-violence-extremism': '#7c3aed',
  'public-order':                 '#0d9488',
};

const CAT_ICON: Record<string, JSX.Element> = {
  'anti-protest': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
      <circle cx="12" cy="12" r="9" />
      <line x1="5.636" y1="5.636" x2="18.364" y2="18.364" />
    </svg>
  ),
  'terrorism-security': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
      <rect x="8" y="11" width="8" height="7" rx="1" />
      <path d="M10 11V7a2 2 0 1 1 4 0v4" />
    </svg>
  ),
  'public-order': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="5" y1="6" x2="12" y2="4" />
      <line x1="19" y1="6" x2="12" y2="4" />
      <path d="M5 6l-1.5 5h3L5 6z" />
      <path d="M19 6l-1.5 5h3L19 6z" />
      <line x1="3.5" y1="20" x2="20.5" y2="20" />
    </svg>
  ),
  'political-violence-extremism': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
      <path d="M12 3l9 16H3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
};

export default function LegislationTracker() {
  // View mode
  const [mode, setMode] = useState<'explorer' | 'list'>('list');

  // Explorer state
  const [exCat, setExCat] = useState<Category | null>(null);
  const [exEntry, setExEntry] = useState<Entry | null>(null);
  const [exFading, setExFading] = useState(false);

  // List state
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['anti-protest']));
  const [openEntries, setOpenEntries] = useState<Set<string>>(new Set());

  // Shared filter state
  const [filterJur, setFilterJur] = useState('All');
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());

  // Explorer navigation with fade transition
  function navigate(cat: Category | null, entry: Entry | null) {
    setExFading(true);
    setTimeout(() => {
      setExCat(cat);
      setExEntry(entry);
      setExFading(false);
    }, 180);
  }

  // Prev/next within a category
  function prevEntry() {
    if (!exCat || !exEntry) return;
    const idx = exCat.entries.indexOf(exEntry);
    if (idx > 0) navigate(exCat, exCat.entries[idx - 1]);
  }
  function nextEntry() {
    if (!exCat || !exEntry) return;
    const idx = exCat.entries.indexOf(exEntry);
    if (idx < exCat.entries.length - 1) navigate(exCat, exCat.entries[idx + 1]);
  }

  function toggleCat(id: string) {
    setOpenCats(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleEntry(id: string) {
    setOpenEntries(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleTag(tag: string) {
    setFilterTags(prev => { const n = new Set(prev); n.has(tag) ? n.delete(tag) : n.add(tag); return n; });
  }
  function clearFilters() {
    setFilterJur('All');
    setFilterTags(new Set());
  }

  const matchesFilters = useMemo(() => (entry: Entry) => {
    if (filterJur !== 'All' && entry.jurisdiction !== filterJur) return false;
    if (filterTags.size > 0 && !entry.tags.some(t => filterTags.has(t))) return false;
    return true;
  }, [filterJur, filterTags]);

  const hasFilter = filterJur !== 'All' || filterTags.size > 0;

  // Group entries by jurisdiction for the explorer grid
  function entriesByJur(cat: Category) {
    const map: Record<string, Entry[]> = {};
    for (const e of cat.entries) {
      if (!matchesFilters(e)) continue;
      if (!map[e.jurisdiction]) map[e.jurisdiction] = [];
      map[e.jurisdiction].push(e);
    }
    return map;
  }

  // ─── Filter bar (shared) ─────────────────────────────
  const filterBar = (
    <div className="leg-filter-bar">
      <div className="leg-filter-group">
        <span className="leg-filter-label">Jurisdiction</span>
        {ALL_JURISDICTIONS.map(j => (
          <button key={j} className={`leg-pill${filterJur === j ? ' leg-pill-active' : ''}`} onClick={() => setFilterJur(j)}>{j}</button>
        ))}
      </div>
      {ALL_TAGS.length > 0 && (
        <div className="leg-filter-group" style={{ marginTop: '0.5rem', flexBasis: '100%' }}>
          <span className="leg-filter-label">Tags</span>
          {ALL_TAGS.map(t => (
            <button key={t} className={`leg-pill${filterTags.has(t) ? ' leg-pill-active' : ''}`} onClick={() => toggleTag(t)}>{t}</button>
          ))}
        </div>
      )}
      {hasFilter && <button className="leg-pill" onClick={clearFilters} style={{ marginLeft: 'auto' }}>Clear ×</button>}
    </div>
  );

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

          {/* View toggle */}
          <div className="leg-view-toggle">
            <button className={`leg-view-tab${mode === 'explorer' ? ' leg-view-tab-active' : ''}`} onClick={() => setMode('explorer')}>
              Explorer
            </button>
            <button className={`leg-view-tab${mode === 'list' ? ' leg-view-tab-active' : ''}`} onClick={() => setMode('list')}>
              List
            </button>
          </div>

          {/* ═══ EXPLORER MODE ═══════════════════════════════════════════ */}
          {mode === 'explorer' && (
            <>
              {/* Breadcrumb */}
              {(exCat || exEntry) && (
                <div className="explorer-breadcrumb">
                  <button className="explorer-back-btn" onClick={() => navigate(exEntry ? exCat : null, null)}>
                    ← {exEntry ? exCat!.label : 'All Categories'}
                  </button>
                  {exCat && <span className="explorer-breadcrumb-sep">/</span>}
                  {exCat && <span className="explorer-breadcrumb-item">{exCat.label}</span>}
                  {exEntry && <span className="explorer-breadcrumb-sep">/</span>}
                  {exEntry && <span className="explorer-breadcrumb-item" style={{ color: 'var(--color-text-muted)' }}>{exEntry.short_title}</span>}
                </div>
              )}

              {/* Filter bar — only on level 0 and 1 */}
              {!exEntry && filterBar}

              <div className={`explorer-stage${exFading ? ' explorer-fading' : ''}`}>
                {/* ─── Level 0: Category tiles ─── */}
                {!exCat && !exEntry && (
                  <div className="explorer-landing">
                    {categories.map(cat => {
                      const accent = CAT_ACCENT[cat.id] ?? 'var(--color-accent)';
                      const matchCount = cat.entries.filter(e => matchesFilters(e)).length;
                      const jurs = [...new Set(cat.entries.map(e => e.jurisdiction))].slice(0, 4);
                      return (
                        <div
                          key={cat.id}
                          className="explorer-cat-tile"
                          style={{ borderTop: `4px solid ${accent}` }}
                          onClick={() => navigate(cat, null)}
                        >
                          <div className="explorer-cat-tile-icon">{CAT_ICON[cat.id]}</div>
                          <h2 className="explorer-cat-tile-title">{cat.label}</h2>
                          <p className="explorer-cat-tile-desc">{cat.description}</p>
                          <div className="explorer-cat-tile-meta">
                            <span className="explorer-cat-tile-count" style={{ background: accent + '18', color: accent, border: `1px solid ${accent}44` }}>
                              {hasFilter ? `${matchCount} / ` : ''}{cat.entries.length} entries
                            </span>
                          </div>
                          <div className="explorer-cat-tile-jurs">
                            {jurs.map(j => <span key={j} className="explorer-jur-chip">{j}</span>)}
                            {[...new Set(cat.entries.map(e => e.jurisdiction))].length > 4 && (
                              <span className="explorer-jur-chip">+{[...new Set(cat.entries.map(e => e.jurisdiction))].length - 4}</span>
                            )}
                          </div>
                          <div className="explorer-cat-tile-cta" style={{ color: accent }}>
                            Explore entries →
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ─── Level 1: Entries grid ─── */}
                {exCat && !exEntry && (
                  <div>
                    <div className="explorer-cat-banner" style={{ borderLeft: `4px solid ${CAT_ACCENT[exCat.id] ?? 'var(--color-accent)'}` }}>
                      <div className="explorer-cat-banner-title">{exCat.label}</div>
                      <div className="explorer-cat-banner-desc">{exCat.description}</div>
                    </div>
                    {Object.entries(entriesByJur(exCat)).map(([jur, entries]) => (
                      <div key={jur} className="explorer-jur-section">
                        <div className="explorer-jur-heading">{jur}</div>
                        <div className="explorer-entries-grid">
                          {entries.map(entry => {
                            const accent = CAT_ACCENT[exCat.id] ?? 'var(--color-accent)';
                            return (
                              <div
                                key={entry.id}
                                className="explorer-entry-card"
                                onClick={() => navigate(exCat, entry)}
                                style={{ cursor: 'pointer', borderTop: `3px solid ${accent}` }}
                              >
                                <div className="explorer-entry-card-year">
                                  {entry.year}{entry.amended ? ` · amended ${entry.amended}` : ''}
                                  {entry.status && <span className="leg-status-badge" style={{ marginLeft: '0.4rem' }}>{entry.status}</span>}
                                </div>
                                <div className="explorer-entry-card-title">{entry.short_title}</div>
                                {entry.tags.slice(0, 2).map(t => (
                                  <span key={t} className="leg-tag" style={{ marginRight: '0.25rem', marginTop: '0.5rem', display: 'inline-block' }}>{t}</span>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ─── Level 2: Entry detail ─── */}
                {exCat && exEntry && (
                  <div className="explorer-detail">
                    {/* Prev/Next nav */}
                    <div className="explorer-detail-nav">
                      <button
                        className="explorer-nav-btn"
                        onClick={prevEntry}
                        disabled={exCat.entries.indexOf(exEntry) === 0}
                      >
                        ← Prev
                      </button>
                      <span className="explorer-nav-pos">
                        {exCat.entries.indexOf(exEntry) + 1} / {exCat.entries.length}
                      </span>
                      <button
                        className="explorer-nav-btn"
                        onClick={nextEntry}
                        disabled={exCat.entries.indexOf(exEntry) === exCat.entries.length - 1}
                      >
                        Next →
                      </button>
                    </div>

                    <div className="explorer-detail-jur">{exEntry.jurisdiction}</div>
                    <h2 className="explorer-detail-title">
                      <a href={exEntry.url} target="_blank" rel="noopener noreferrer">
                        {exEntry.full_title} ↗
                      </a>
                    </h2>
                    <div className="explorer-detail-year">
                      {exEntry.year}{exEntry.amended ? `, amended ${exEntry.amended}` : ''}
                      {exEntry.status && <span className="leg-status-badge" style={{ marginLeft: '0.75rem' }}>{exEntry.status}</span>}
                    </div>

                    <div className="explorer-detail-section-label">Key provisions</div>
                    <ul className="explorer-detail-provisions">
                      {exEntry.key_provisions.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>

                    <div className="explorer-detail-section-label">Commentary</div>
                    <p className="explorer-detail-commentary">{exEntry.commentary}</p>

                    {exEntry.tags.length > 0 && (
                      <>
                        <div className="explorer-detail-section-label">Tags</div>
                        <div className="leg-tags" style={{ marginBottom: '1rem' }}>
                          {exEntry.tags.map(t => <span key={t} className="leg-tag">{t}</span>)}
                        </div>
                      </>
                    )}

                    {exEntry.related_cases.length > 0 && (
                      <>
                        <div className="explorer-detail-section-label">Related cases</div>
                        <div className="leg-related-cases">
                          {exEntry.related_cases.map(c => (
                            <span key={c} className="leg-case-pill" title="See Cases database">{c}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ LIST MODE ═══════════════════════════════════════════════ */}
          {mode === 'list' && (
            <>
              {filterBar}
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
                              <span className="leg-cat-count">{hasFilter ? `${visibleCount} / ` : ''}{cat.entries.length} entries</span>
                              <svg className="leg-cat-caret" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </div>
                          {isOpen && (
                            <div className="leg-entries">
                              {cat.entries.filter(e => matchesFilters(e)).map(entry => {
                                const isEntryOpen = openEntries.has(entry.id);
                                return (
                                  <div key={entry.id} className={`leg-entry${isEntryOpen ? ' leg-entry-open' : ''}`}>
                                    <div className="leg-entry-header" onClick={() => toggleEntry(entry.id)}>
                                      <div>
                                        <div className="leg-entry-jur">{entry.jurisdiction}</div>
                                        <div className="leg-entry-title">
                                          {entry.short_title}
                                          {entry.status && <span className="leg-status-badge">{entry.status}</span>}
                                        </div>
                                        <div className="leg-entry-year">{entry.year}{entry.amended ? `, amended ${entry.amended}` : ''}</div>
                                      </div>
                                      <svg className="leg-entry-caret" width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </div>
                                    {isEntryOpen && (
                                      <div className="leg-entry-body">
                                        <h4>Full title</h4>
                                        <p><a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.full_title} ↗</a></p>
                                        <h4>Key provisions</h4>
                                        <ul>{entry.key_provisions.map((p, i) => <li key={i}>{p}</li>)}</ul>
                                        <h4>Commentary</h4>
                                        <p>{entry.commentary}</p>
                                        {entry.tags.length > 0 && (
                                          <>
                                            <h4>Tags</h4>
                                            <div className="leg-tags">{entry.tags.map(t => <span key={t} className="leg-tag">{t}</span>)}</div>
                                          </>
                                        )}
                                        {entry.related_cases.length > 0 && (
                                          <>
                                            <h4>Related cases</h4>
                                            <div className="leg-related-cases">
                                              {entry.related_cases.map(c => <span key={c} className="leg-case-pill" title="See Cases database">{c}</span>)}
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
            </>
          )}

          <p className="db-note" style={{ marginTop: '2rem' }}>{data.metadata.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
