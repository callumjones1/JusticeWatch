import { useState, useMemo } from 'react';
import { useSheetData } from '../hooks/useSheetData';
import { JURISDICTION_COLORS } from '../data/cases';

type SortKey = 'year' | 'name' | 'jurisdiction';
type SortDir = 'asc' | 'desc';

export default function Database() {
  const { cases, source } = useSheetData();

  const allTags         = useMemo(() => Array.from(new Set(cases.flatMap(c => c.tags))).sort(), [cases]);
  const allJurisdictions = useMemo(() => Array.from(new Set(cases.map(c => c.jurisdiction))).sort(), [cases]);

  const [search,             setSearch]             = useState('');
  const [activeTag,          setActiveTag]          = useState<string | null>(null);
  const [activeJurisdiction, setActiveJurisdiction] = useState<string | null>(null);
  const [sortKey,            setSortKey]            = useState<SortKey>('year');
  const [sortDir,            setSortDir]            = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let result = cases;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.citation.toLowerCase().includes(q));
    }
    if (activeTag)          result = result.filter(c => c.tags.includes(activeTag));
    if (activeJurisdiction) result = result.filter(c => c.jurisdiction === activeJurisdiction);
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'year')         cmp = a.year - b.year;
      else if (sortKey === 'name')    cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'jurisdiction') cmp = a.jurisdiction.localeCompare(b.jurisdiction);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [cases, search, activeTag, activeJurisdiction, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="sort-icon sort-icon-neutral">↕</span>;
    return <span className="sort-icon sort-icon-active">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="database-page">
      <div className="page-header">
        <h1>Case Database</h1>
        <p className="page-subtitle">Prosecutions linked to political violence and civil activism in Australia</p>
      </div>

      <section className="section">
        <div className="container">

          {/* Data source banner */}
          <div className={`viz-source-banner ${source === 'live' ? 'viz-source-live' : source === 'loading' ? 'viz-source-loading' : 'viz-source-fallback'}`} style={{ marginBottom: '1.5rem' }}>
            {source === 'loading' && <><span className="viz-source-spinner" /> Syncing from Google Sheets…</>}
            {source === 'live'    && <><span className="viz-source-dot" /> Live · {cases.length} cases from Google Sheets</>}
            {source === 'fallback' && <><span className="viz-source-dot viz-source-dot-warn" /> Seeded data · publish the spreadsheet to enable live sync</>}
          </div>

          <div className="db-toolbar">
            <div className="db-search-wrapper">
              <svg className="db-search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="db-search" type="text" placeholder="Search by case name or citation…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="db-search-clear" onClick={() => setSearch('')} aria-label="Clear">×</button>}
            </div>
            <span className="db-count">{filtered.length} case{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="db-filters">
            <div className="db-filter-group">
              <span className="db-filter-label">Jurisdiction</span>
              <div className="db-filter-pills">
                <button className={`db-pill ${activeJurisdiction === null ? 'db-pill-active' : ''}`} onClick={() => setActiveJurisdiction(null)}>All</button>
                {allJurisdictions.map(j => (
                  <button key={j} className={`db-pill ${activeJurisdiction === j ? 'db-pill-active' : ''}`}
                    onClick={() => setActiveJurisdiction(activeJurisdiction === j ? null : j)}>{j}</button>
                ))}
              </div>
            </div>
            {allTags.length > 0 && (
              <div className="db-filter-group">
                <span className="db-filter-label">Tags</span>
                <div className="db-filter-pills">
                  <button className={`db-pill ${activeTag === null ? 'db-pill-active' : ''}`} onClick={() => setActiveTag(null)}>All</button>
                  {allTags.map(t => (
                    <button key={t} className={`db-pill ${activeTag === t ? 'db-pill-active' : ''}`}
                      onClick={() => setActiveTag(activeTag === t ? null : t)}>{t}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="db-table-wrapper">
            <table className="db-table">
              <thead>
                <tr>
                  <th className="db-th db-th-sortable" onClick={() => handleSort('name')}>Case <SortIcon col="name" /></th>
                  <th className="db-th">Citation</th>
                  <th className="db-th db-th-sortable" onClick={() => handleSort('year')}>Year <SortIcon col="year" /></th>
                  <th className="db-th db-th-sortable" onClick={() => handleSort('jurisdiction')}>Jurisdiction <SortIcon col="jurisdiction" /></th>
                  <th className="db-th">Charges</th>
                  <th className="db-th">Outcome</th>
                  <th className="db-th">Tags</th>
                  <th className="db-th">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="db-empty">No cases match your search.</td></tr>
                ) : filtered.map((c, i) => (
                  <tr key={i} className="db-row">
                    <td className="db-td db-td-name">{c.name}</td>
                    <td className="db-td db-td-citation">{c.citation}</td>
                    <td className="db-td db-td-year">{c.year || '—'}</td>
                    <td className="db-td">
                      <span className={`db-jurisdiction db-jurisdiction-${c.jurisdiction.toLowerCase().replace(/\s+/g, '-')}`}
                        style={{ background: `${JURISDICTION_COLORS[c.jurisdiction] ?? '#555'}18`, color: JURISDICTION_COLORS[c.jurisdiction] ?? '#555' }}>
                        {c.jurisdiction}
                      </span>
                    </td>
                    <td className="db-td db-td-muted">{c.charges  || '—'}</td>
                    <td className="db-td db-td-muted">{c.outcome  || '—'}</td>
                    <td className="db-td">
                      {c.tags.length > 0 ? c.tags.map(t => <span key={t} className="db-tag">{t}</span>) : <span className="db-td-muted">—</span>}
                    </td>
                    <td className="db-td">
                      {c.link ? (
                        <a href={c.link} target="_blank" rel="noopener noreferrer" className="db-link">
                          AustLII
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="db-note">
            Charges, outcomes, and summaries are being progressively populated.
            To contribute, <a href="#/contact">contact us</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
