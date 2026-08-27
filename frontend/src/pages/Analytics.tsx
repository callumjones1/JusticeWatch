import { useEffect, useMemo, useState } from 'react';
import legislationData from '../data/legislation_tracker.json';
import incidentsData from '../data/incidents_tracker.json';
import casesData from '../data/protest_cases.json';
import { getFacets, type Facets } from '../api/events';

type NodeType = 'legislation' | 'incident' | 'case' | 'media';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  sub: string;
  year: number | null;
  weight: number;
  url?: string;
}

interface LaidOutNode extends GraphNode {
  x: number;
  y: number;
}

const TYPE_META: Record<NodeType, { label: string; color: string }> = {
  legislation: { label: 'Legislation', color: '#1d3a5c' },
  incident: { label: 'Incidents', color: '#dc2626' },
  case: { label: 'Cases', color: '#8b5cf6' },
  media: { label: 'News Media Coverage', color: '#d4a853' },
};

const WIDTH = 1100;
const HEIGHT = 680;

const CENTERS: Record<NodeType, { x: number; y: number }> = {
  legislation: { x: WIDTH * 0.25, y: HEIGHT * 0.28 },
  incident: { x: WIDTH * 0.75, y: HEIGHT * 0.28 },
  case: { x: WIDTH * 0.25, y: HEIGHT * 0.76 },
  media: { x: WIDTH * 0.75, y: HEIGHT * 0.76 },
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function nodeRadius(n: GraphNode): number {
  if (n.type === 'media') return Math.min(30, 8 + Math.sqrt(n.weight) / 5);
  return 8;
}

// Deterministic, dependency-free force layout: repel overlapping nodes, pull
// each node toward its type's quadrant centre. Runs once per node set — there
// are no edges yet, so this only needs to settle into readable clusters, not
// support live simulation.
function layoutNodes(nodes: GraphNode[]): LaidOutNode[] {
  const pts: LaidOutNode[] = nodes.map(n => {
    const seed = hashStr(n.id);
    const c = CENTERS[n.type];
    const jx = (seed % 260) - 130;
    const jy = (Math.floor(seed / 260) % 260) - 130;
    return { ...n, x: c.x + jx, y: c.y + jy };
  });

  for (let iter = 0; iter < 100; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i];
        const b = pts[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minDist = nodeRadius(a) + nodeRadius(b) + 5;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          dx /= dist;
          dy /= dist;
          a.x += dx * push;
          a.y += dy * push;
          b.x -= dx * push;
          b.y -= dy * push;
        }
      }
    }
    for (const p of pts) {
      const c = CENTERS[p.type];
      p.x += (c.x - p.x) * 0.025;
      p.y += (c.y - p.y) * 0.025;
      const r = nodeRadius(p);
      p.x = Math.min(WIDTH - r, Math.max(r, p.x));
      p.y = Math.min(HEIGHT - r, Math.max(r, p.y));
    }
  }
  return pts;
}

type LegEntry = {
  id: string; short_title: string; jurisdiction: string; year: number; url: string;
};
type LegCategory = { id: string; label: string; entries: LegEntry[] };
type IncidentMini = { id: string; short_title: string; location: string; year: number };
type CaseMini = { id: string; case_name: string; jurisdiction_normalised: string; year: number; url: string };

const legislationCategories = legislationData.categories as LegCategory[];
const incidentsList = incidentsData.incidents as IncidentMini[];
const casesList = casesData.cases as CaseMini[];

const ALL_YEARS = [
  ...legislationCategories.flatMap(c => c.entries.map(e => e.year)),
  ...incidentsList.map(i => i.year),
  ...casesList.map(c => c.year),
].sort((a, b) => a - b);
const MIN_YEAR = ALL_YEARS[0];
const MAX_YEAR = ALL_YEARS[ALL_YEARS.length - 1];

export default function Analytics() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [facetsError, setFacetsError] = useState(false);

  const [typeVisible, setTypeVisible] = useState<Record<NodeType, boolean>>({
    legislation: true, incident: true, case: true, media: true,
  });
  const [search, setSearch] = useState('');
  const [yearFrom, setYearFrom] = useState(MIN_YEAR);
  const [yearTo, setYearTo] = useState(MAX_YEAR);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getFacets(controller.signal)
      .then(setFacets)
      .catch(err => { if (err.name !== 'AbortError') setFacetsError(true); });
    return () => controller.abort();
  }, []);

  const rawNodes: GraphNode[] = useMemo(() => {
    const legislation: GraphNode[] = legislationCategories.flatMap(cat =>
      cat.entries.map(e => ({
        id: e.id, type: 'legislation' as const, label: e.short_title,
        sub: `${e.jurisdiction} · ${cat.label}`, year: e.year, weight: 1, url: e.url,
      }))
    );
    const incidents: GraphNode[] = incidentsList.map(i => ({
      id: i.id, type: 'incident' as const, label: i.short_title,
      sub: i.location, year: i.year, weight: 1,
    }));
    const cases: GraphNode[] = casesList.map(c => ({
      id: c.id, type: 'case' as const, label: c.case_name,
      sub: c.jurisdiction_normalised, year: c.year, weight: 1, url: c.url,
    }));
    const media: GraphNode[] = (facets?.categories ?? []).map(c => ({
      id: `media-${c.key}`, type: 'media' as const, label: c.label,
      sub: `${c.event_count.toLocaleString()} news articles`, year: null, weight: c.event_count,
    }));
    return [...legislation, ...incidents, ...cases, ...media];
  }, [facets]);

  const laidOut = useMemo(() => layoutNodes(rawNodes), [rawNodes]);

  const typeCounts = useMemo(() => {
    const counts: Record<NodeType, number> = { legislation: 0, incident: 0, case: 0, media: 0 };
    for (const n of rawNodes) counts[n.type]++;
    return counts;
  }, [rawNodes]);

  const q = search.trim().toLowerCase();
  function isMatch(n: GraphNode): boolean {
    if (!typeVisible[n.type]) return false;
    if (n.year !== null && (n.year < yearFrom || n.year > yearTo)) return false;
    if (q && !n.label.toLowerCase().includes(q) && !n.sub.toLowerCase().includes(q)) return false;
    return true;
  }

  function toggleType(t: NodeType) {
    setTypeVisible(prev => ({ ...prev, [t]: !prev[t] }));
  }

  const hasFilter = search !== '' || yearFrom !== MIN_YEAR || yearTo !== MAX_YEAR ||
    Object.values(typeVisible).some(v => !v);

  function clearFilters() {
    setSearch('');
    setYearFrom(MIN_YEAR);
    setYearTo(MAX_YEAR);
    setTypeVisible({ legislation: true, incident: true, case: true, media: true });
  }

  const visibleCount = laidOut.filter(isMatch).length;

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Analytics</h1>
          <p className="page-subtitle">Cross-database analysis tools for Justice Watch data</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <p className="db-note" style={{ textAlign: 'left', marginTop: 0, marginBottom: '1.25rem' }}>
            The first analysis in this module is a <strong>network map</strong>: every legislation, incident, case,
            and news-coverage record plotted as a node, clustered by database. Edges connecting related records
            across databases don't exist in the data yet — that connective layer is being built separately and will
            appear here once available. For now, use the filters to explore each cluster.
          </p>

          <div className="analytics-toolbar">
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
                placeholder="Search node labels…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="db-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
              )}
            </div>
            <span className="db-count">{visibleCount.toLocaleString()} of {rawNodes.length.toLocaleString()} nodes</span>
          </div>

          <div className="analytics-filter-bar">
            <div className="leg-filter-group">
              <span className="leg-filter-label">Databases</span>
              {(Object.keys(TYPE_META) as NodeType[]).map(t => (
                <button
                  key={t}
                  className={`db-pill${typeVisible[t] ? ' db-pill-active' : ''}`}
                  onClick={() => toggleType(t)}
                  style={typeVisible[t] ? { background: TYPE_META[t].color, borderColor: TYPE_META[t].color } : undefined}
                >
                  {TYPE_META[t].label} ({typeCounts[t]})
                </button>
              ))}
            </div>
            <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
              <span className="leg-filter-label">Year range</span>
              <div className="inc-year-range">
                <span>{yearFrom}</span>
                <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={yearFrom}
                  onChange={e => setYearFrom(Math.min(Number(e.target.value), yearTo))} />
                <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={yearTo}
                  onChange={e => setYearTo(Math.max(Number(e.target.value), yearFrom))} />
                <span>{yearTo}</span>
              </div>
              <span className="events-detail-note">Applies to legislation, incidents and cases (news-coverage categories are undated).</span>
              {hasFilter && (
                <button className="leg-pill" onClick={clearFilters} style={{ marginLeft: 'auto' }}>Clear ×</button>
              )}
            </div>
          </div>

          {facetsError && (
            <p className="events-detail-note" style={{ marginBottom: '1rem' }}>
              Could not load news-coverage categories from the API — showing legislation, incidents and cases only.
            </p>
          )}

          <div className="analytics-layout">
            <div className="analytics-graph-wrapper">
              <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="analytics-graph-svg" role="img" aria-label="Network map of legislation, incidents, cases and news coverage">
                {laidOut.map(n => {
                  const visible = isMatch(n);
                  const isSelected = selected?.id === n.id;
                  return (
                    <circle
                      key={n.id}
                      cx={n.x}
                      cy={n.y}
                      r={nodeRadius(n)}
                      fill={TYPE_META[n.type].color}
                      opacity={visible ? (isSelected ? 1 : 0.85) : 0.08}
                      stroke={isSelected ? 'var(--color-text)' : 'var(--color-surface)'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      style={{ cursor: visible ? 'pointer' : 'default', transition: 'opacity 0.2s' }}
                      onClick={() => visible && setSelected(n)}
                    >
                      <title>{n.label} — {TYPE_META[n.type].label}</title>
                    </circle>
                  );
                })}
              </svg>
              <div className="cases-chart-legend" style={{ marginTop: '0.75rem' }}>
                {(Object.keys(TYPE_META) as NodeType[]).map(t => (
                  <div key={t} className="cases-legend-item">
                    <span className="cases-legend-dot" style={{ background: TYPE_META[t].color }} />
                    {TYPE_META[t].label}
                  </div>
                ))}
              </div>
            </div>

            <div className="analytics-detail-panel">
              {selected ? (
                <>
                  <span className="db-pill db-pill-active" style={{ background: TYPE_META[selected.type].color, borderColor: TYPE_META[selected.type].color, cursor: 'default' }}>
                    {TYPE_META[selected.type].label}
                  </span>
                  <h3 className="analytics-detail-title">{selected.label}</h3>
                  <p className="analytics-detail-sub">{selected.sub}</p>
                  {selected.year !== null && <p className="analytics-detail-sub">Year: {selected.year}</p>}
                  {selected.url && (
                    <p style={{ marginTop: '0.75rem' }}>
                      <a href={selected.url} target="_blank" rel="noopener noreferrer" className="db-link">View source ↗</a>
                    </p>
                  )}
                  <p className="events-detail-note" style={{ marginTop: '1.25rem' }}>
                    No linked records yet — connections between this node and other databases are pending a
                    forthcoming edge dataset.
                  </p>
                </>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  Click a node to see its details.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
