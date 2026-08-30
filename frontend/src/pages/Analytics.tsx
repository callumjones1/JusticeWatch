import { useEffect, useMemo, useRef, useState } from 'react';
import legislationData from '../data/legislation_tracker.json';
import incidentsData from '../data/incidents_tracker.json';
import casesData from '../data/cases.json';
import edgesData from '../data/case_legislation_edges.json';
import legIndexData from '../data/legislation_index.json';
import NetworkGraph, { type NetworkGraphHandle, type LayoutAlgo, type SizeMode } from '../components/NetworkGraph';
import { normalizeSourceType, type SourceTypeLabel } from '../lib/sourceTypes';

type NodeType = 'legislation' | 'incident' | 'case' | 'source';
type CaseRegister = 'protest' | 'political_violence';
type AnalyticsTab = 'network' | 'legislationIndex';
type MapSubView = 'graph' | 'edgelist';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  sub: string;
  year: number | null;
  url?: string;
  caseRegister?: CaseRegister;
  sourceBucket?: SourceTypeLabel;
  summary?: string;
}

const TYPE_META: Record<NodeType, { label: string; color: string }> = {
  legislation: { label: 'Legislation', color: '#1d3a5c' },
  incident: { label: 'Incidents', color: '#dc2626' },
  case: { label: 'Cases', color: '#8b5cf6' },
  source: { label: 'Sources', color: '#6b7280' },
};

const CASE_REGISTER_META: Record<CaseRegister, { label: string; color: string }> = {
  protest: { label: 'Protest cases', color: '#0d9488' },
  political_violence: { label: 'Political violence cases', color: '#dc2626' },
};

const INCIDENT_SOURCE_EDGE_COLOUR = '#94a3b8';
const GRAPH_HEIGHT = 620;
const LAYOUT_META: Record<LayoutAlgo, string> = {
  clustered: 'Clustered',
  force: 'Force-directed',
  circular: 'Circular',
};
const SIZE_MODE_META: Record<SizeMode, string> = {
  degree: 'Degree centrality',
  uniform: 'Uniform',
};

type LegEntry = { id: string; short_title: string; jurisdiction: string; year: number; url: string };
type LegCategory = { id: string; label: string; entries: LegEntry[] };
type IncidentSource = { type: string; title: string; url: string; summary: string };
type IncidentMini = { id: string; short_title: string; location: string; year: number; sources?: IncidentSource[] };
type CaseMini = {
  id: string; case_name: string; jurisdiction_display: string | null; year: number;
  url: string | null; register: CaseRegister;
};
type CaseLegislationEdge = { case_id: string; legislation_id: string; provision: string | null; register: CaseRegister };
type LegIndexRow = {
  register: CaseRegister; name: string; jurisdiction: string | null; provision: string | null;
  category: string | null; cases: number; cited: number | null; inferred: number | null;
  earliest_year: string | number | null; latest_year: string | number | null;
  example_case: string | null; legislation_id: string | null;
};

const legislationCategories = legislationData.categories as LegCategory[];
const incidentsList = incidentsData.incidents as IncidentMini[];
const casesList = casesData.cases as CaseMini[];
const edges = edgesData as CaseLegislationEdge[];
const legIndex = legIndexData as LegIndexRow[];

const legislationById = new Map(legislationCategories.flatMap(c => c.entries.map(e => [e.id, e])));
const caseById = new Map(casesList.map(c => [c.id, c]));

const incidentSourceEdges: { incidentId: string; sourceId: string }[] = [];
const sourceNodes: GraphNode[] = [];
incidentsList.forEach(inc => {
  (inc.sources ?? []).forEach((s, idx) => {
    const bucket = normalizeSourceType(s.type);
    const id = `source_${inc.id}_${idx}`;
    sourceNodes.push({
      id, type: 'source', label: s.title, sub: bucket, year: inc.year,
      url: s.url, sourceBucket: bucket, summary: s.summary,
    });
    incidentSourceEdges.push({ incidentId: inc.id, sourceId: id });
  });
});

const rawNodes: GraphNode[] = [
  ...legislationCategories.flatMap(cat =>
    cat.entries.map(e => ({
      id: e.id, type: 'legislation' as const, label: e.short_title,
      sub: `${e.jurisdiction} · ${cat.label}`, year: e.year, url: e.url,
    }))
  ),
  ...incidentsList.map(i => ({
    id: i.id, type: 'incident' as const, label: i.short_title,
    sub: i.location, year: i.year,
  })),
  ...casesList.map(c => ({
    id: c.id, type: 'case' as const, label: c.case_name,
    sub: c.jurisdiction_display ?? 'Jurisdiction not identified', year: c.year,
    url: c.url ?? undefined, caseRegister: c.register,
  })),
  ...sourceNodes,
];

const nodeById = new Map(rawNodes.map(n => [n.id, n]));

type CombinedEdge = { from: string; to: string; colour: string };
const combinedEdges: CombinedEdge[] = [
  ...edges.map(e => ({ from: e.case_id, to: e.legislation_id, colour: CASE_REGISTER_META[e.register].color })),
  ...incidentSourceEdges.map(e => ({ from: e.incidentId, to: e.sourceId, colour: INCIDENT_SOURCE_EDGE_COLOUR })),
];

const ALL_YEARS = rawNodes.map(n => n.year).filter((y): y is number => y !== null).sort((a, b) => a - b);
const MIN_YEAR = ALL_YEARS[0];
const MAX_YEAR = ALL_YEARS[ALL_YEARS.length - 1];

type LinkedRecord = { label: string; note?: string };
type ContextMenuState = { x: number; y: number; actions: { label: string; onClick: () => void }[] };
type FocusRequest = { targetId: string; edgeOtherId?: string; nonce: number };

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function truncateLabel(s: string, maxChars: number): string {
  return s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;
}

const LEG_CHART_W = 900;
const LEG_CHART_ROW_H = 34;
const LEG_CHART_BAR_H = 22;
const LEG_CHART_LEFT = 250;
const LEG_CHART_RIGHT = 56;

function LegislationIndexChart({
  rows, legislationById,
}: {
  rows: LegIndexRow[];
  legislationById: Map<string, LegEntry>;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; row: LegIndexRow } | null>(null);
  const innerW = LEG_CHART_W - LEG_CHART_LEFT - LEG_CHART_RIGHT;
  const maxCases = Math.max(...rows.map(r => r.cases ?? 0), 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxCases * f));
  const chartH = rows.length * LEG_CHART_ROW_H + 16;

  if (rows.length === 0) {
    return <p className="events-detail-note">No provisions match the current filters.</p>;
  }

  return (
    <div>
      <div className="cases-chart-legend" style={{ marginBottom: '0.75rem' }}>
        {(Object.keys(CASE_REGISTER_META) as CaseRegister[]).map(r => (
          <div key={r} className="cases-legend-item">
            <span className="cases-legend-dot" style={{ background: CASE_REGISTER_META[r].color }} />
            {CASE_REGISTER_META[r].label}
          </div>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${LEG_CHART_W} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {ticks.map((t, i) => {
            const x = LEG_CHART_LEFT + (t / maxCases) * innerW;
            return (
              <g key={i}>
                <line x1={x} y1={4} x2={x} y2={chartH - 12} stroke="var(--color-border)" strokeWidth={1} />
                <text x={x} y={chartH - 2} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">{t}</text>
              </g>
            );
          })}
          {rows.map((r, i) => {
            const cy = 12 + i * LEG_CHART_ROW_H;
            const barW = Math.max(2, (r.cases ?? 0) / maxCases * innerW);
            const colour = CASE_REGISTER_META[r.register].color;
            const linkedEntry = r.legislation_id ? legislationById.get(r.legislation_id) : undefined;
            const barTop = cy - LEG_CHART_BAR_H / 2;
            const path = barW <= 4
              ? `M${LEG_CHART_LEFT},${barTop} h${barW} v${LEG_CHART_BAR_H} h${-barW} Z`
              : `M${LEG_CHART_LEFT},${barTop} H${LEG_CHART_LEFT + barW - 4} Q${LEG_CHART_LEFT + barW},${barTop} ${LEG_CHART_LEFT + barW},${barTop + 4} V${barTop + LEG_CHART_BAR_H - 4} Q${LEG_CHART_LEFT + barW},${barTop + LEG_CHART_BAR_H} ${LEG_CHART_LEFT + barW - 4},${barTop + LEG_CHART_BAR_H} H${LEG_CHART_LEFT} Z`;
            return (
              <g key={i}>
                <text x={LEG_CHART_LEFT - 10} y={cy + 4} textAnchor="end" fontSize="11" fill="var(--color-text)">
                  {truncateLabel(r.name, 34)}
                </text>
                <path
                  d={path}
                  fill={colour}
                  style={{ cursor: linkedEntry ? 'pointer' : 'default' }}
                  onClick={() => linkedEntry && window.open(linkedEntry.url, '_blank', 'noopener,noreferrer')}
                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, row: r })}
                  onMouseMove={e => setTooltip({ x: e.clientX, y: e.clientY, row: r })}
                  onMouseLeave={() => setTooltip(null)}
                />
                <text x={LEG_CHART_LEFT + barW + 8} y={cy + 4} fontSize="11" fill="var(--color-text-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {r.cases}
                </text>
              </g>
            );
          })}
        </svg>
        {tooltip && (
          <div
            style={{
              position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10, zIndex: 1000, pointerEvents: 'none',
              background: 'var(--color-primary)', color: 'var(--color-text-light)', padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', maxWidth: '260px', boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>{tooltip.row.name}</div>
            {tooltip.row.category && <div style={{ opacity: 0.75 }}>{tooltip.row.category}</div>}
            <div style={{ opacity: 0.75 }}>{CASE_REGISTER_META[tooltip.row.register].label} · {tooltip.row.cases} cases</div>
            {tooltip.row.earliest_year && tooltip.row.latest_year && (
              <div style={{ opacity: 0.75 }}>{tooltip.row.earliest_year}–{tooltip.row.latest_year}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('network');
  const [mapSubView, setMapSubView] = useState<MapSubView>('graph');

  const [typeVisible, setTypeVisible] = useState<Record<NodeType, boolean>>({
    legislation: true, incident: true, case: true, source: true,
  });
  const [colourMode, setColourMode] = useState<'database' | 'caseType'>('database');
  const [sizeMode, setSizeMode] = useState<SizeMode>('degree');
  const [layoutAlgo, setLayoutAlgo] = useState<LayoutAlgo>('clustered');
  const [repulsion, setRepulsion] = useState(1);
  const debouncedRepulsion = useDebouncedValue(repulsion, 200);
  const [showEdges, setShowEdges] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 300);
  const [yearFrom, setYearFrom] = useState(MIN_YEAR);
  const [yearTo, setYearTo] = useState(MAX_YEAR);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const graphCmdRef = useRef<NetworkGraphHandle | null>(null);

  const [edgeSearch, setEdgeSearch] = useState('');
  const [edgeRegisterFilter, setEdgeRegisterFilter] = useState<'all' | CaseRegister>('all');

  const [legIdxSearch, setLegIdxSearch] = useState('');
  const [legIdxRegister, setLegIdxRegister] = useState<'all' | CaseRegister>('all');
  const [legIdxSort, setLegIdxSort] = useState<'cases' | 'name' | 'latest_year'>('cases');
  const [legIdxView, setLegIdxView] = useState<'visualise' | 'data'>('visualise');

  function nodeColour(n: GraphNode): string {
    if (colourMode === 'caseType' && n.type === 'case' && n.caseRegister) {
      return CASE_REGISTER_META[n.caseRegister].color;
    }
    return TYPE_META[n.type].color;
  }

  const typeCounts = useMemo(() => {
    const counts: Record<NodeType, number> = { legislation: 0, incident: 0, case: 0, source: 0 };
    for (const n of rawNodes) counts[n.type]++;
    return counts;
  }, []);

  const baseNodes = useMemo(() => {
    return rawNodes.filter(n => {
      if (!typeVisible[n.type]) return false;
      if (n.year !== null && (n.year < yearFrom || n.year > yearTo)) return false;
      if (debouncedSearch && !n.label.toLowerCase().includes(debouncedSearch) && !n.sub.toLowerCase().includes(debouncedSearch)) return false;
      return true;
    });
  }, [typeVisible, yearFrom, yearTo, debouncedSearch]);

  const baseNodeIds = useMemo(() => new Set(baseNodes.map(n => n.id)), [baseNodes]);

  const baseEdges = useMemo(
    () => combinedEdges.filter(e => baseNodeIds.has(e.from) && baseNodeIds.has(e.to)),
    [baseNodeIds]
  );

  const graphNodes = useMemo(
    () => baseNodes.map(n => ({ id: n.id, type: n.type, label: n.label, sub: n.sub, year: n.year, url: n.url, colour: nodeColour(n) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseNodes, colourMode]
  );

  const graphEdges = useMemo(() => (showEdges ? baseEdges : []), [showEdges, baseEdges]);

  const hasFilter = search !== '' || yearFrom !== MIN_YEAR || yearTo !== MAX_YEAR ||
    Object.values(typeVisible).some(v => !v);

  function toggleType(t: NodeType) {
    setTypeVisible(prev => ({ ...prev, [t]: !prev[t] }));
  }

  function clearFilters() {
    setSearch('');
    setYearFrom(MIN_YEAR);
    setYearTo(MAX_YEAR);
    setTypeVisible({ legislation: true, incident: true, case: true, source: true });
  }

  function revealNode(node: GraphNode) {
    setTypeVisible(prev => (prev[node.type] ? prev : { ...prev, [node.type]: true }));
    setSearch('');
    if (node.year !== null) {
      setYearFrom(f => Math.min(f, node.year as number));
      setYearTo(t => Math.max(t, node.year as number));
    }
  }

  function showNodeInMap(nodeId: string) {
    const node = nodeById.get(nodeId);
    if (!node) return;
    revealNode(node);
    setActiveTab('network');
    setMapSubView('graph');
    setFocusRequest({ targetId: nodeId, nonce: Date.now() });
    setContextMenu(null);
  }

  function showEdgeInMap(caseId: string, legislationId: string) {
    const a = nodeById.get(caseId);
    const b = nodeById.get(legislationId);
    if (!a || !b) return;
    revealNode(a);
    revealNode(b);
    setActiveTab('network');
    setMapSubView('graph');
    setFocusRequest({ targetId: caseId, edgeOtherId: legislationId, nonce: Date.now() });
    setContextMenu(null);
  }

  useEffect(() => {
    if (!focusRequest) return;
    if (!baseNodeIds.has(focusRequest.targetId)) return;
    if (focusRequest.edgeOtherId) {
      if (!baseNodeIds.has(focusRequest.edgeOtherId)) return;
      graphCmdRef.current?.focusEdge(focusRequest.targetId, focusRequest.edgeOtherId);
    } else {
      graphCmdRef.current?.focusNode(focusRequest.targetId);
    }
    setFocusRequest(null);
  }, [baseNodeIds, focusRequest]);

  function handleNodeContextMenu(id: string, clientX: number, clientY: number) {
    const n = nodeById.get(id);
    if (!n) return;
    const actions: { label: string; onClick: () => void }[] = [];
    if (n.url) {
      actions.push({ label: 'Open source ↗', onClick: () => window.open(n.url, '_blank', 'noopener,noreferrer') });
    }
    actions.push({ label: 'Select node', onClick: () => setSelectedId(id) });
    setContextMenu({ x: clientX, y: clientY, actions });
  }

  useEffect(() => {
    function dismiss() { setContextMenu(null); }
    document.addEventListener('click', dismiss);
    return () => document.removeEventListener('click', dismiss);
  }, []);

  function getLinkedForSelected(sel: GraphNode): LinkedRecord[] {
    if (sel.type === 'case' || sel.type === 'legislation') {
      return edges
        .filter(e => e.case_id === sel.id || e.legislation_id === sel.id)
        .map((e): LinkedRecord | null => {
          const otherId = e.case_id === sel.id ? e.legislation_id : e.case_id;
          const other = nodeById.get(otherId);
          return other ? { label: other.label, note: e.provision ?? undefined } : null;
        })
        .filter((x): x is LinkedRecord => x !== null);
    }
    if (sel.type === 'incident') {
      return incidentSourceEdges
        .filter(e => e.incidentId === sel.id)
        .map((e): LinkedRecord | null => {
          const s = nodeById.get(e.sourceId);
          return s ? { label: s.label, note: s.sub } : null;
        })
        .filter((x): x is LinkedRecord => x !== null);
    }
    if (sel.type === 'source') {
      return incidentSourceEdges
        .filter(e => e.sourceId === sel.id)
        .map((e): LinkedRecord | null => {
          const inc = nodeById.get(e.incidentId);
          return inc ? { label: inc.label, note: 'Incident' } : null;
        })
        .filter((x): x is LinkedRecord => x !== null);
    }
    return [];
  }

  // --- Edge list ---
  const edgeRows = useMemo(() => {
    const s = edgeSearch.trim().toLowerCase();
    return edges.filter(e => {
      if (edgeRegisterFilter !== 'all' && e.register !== edgeRegisterFilter) return false;
      if (!s) return true;
      const c = caseById.get(e.case_id);
      const l = legislationById.get(e.legislation_id);
      return (c?.case_name.toLowerCase().includes(s)) || (l?.short_title.toLowerCase().includes(s));
    });
  }, [edgeSearch, edgeRegisterFilter]);

  // --- Legislation index panel ---
  const legIdxFiltered = useMemo(() => {
    const s = legIdxSearch.trim().toLowerCase();
    return legIndex.filter(r => {
      if (legIdxRegister !== 'all' && r.register !== legIdxRegister) return false;
      if (s && !(r.name ?? '').toLowerCase().includes(s)) return false;
      return true;
    });
  }, [legIdxSearch, legIdxRegister]);

  const legIdxSorted = useMemo(() => {
    return [...legIdxFiltered].sort((a, b) => {
      if (legIdxSort === 'cases') return (b.cases ?? 0) - (a.cases ?? 0);
      if (legIdxSort === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
      return String(b.latest_year ?? '').localeCompare(String(a.latest_year ?? ''));
    });
  }, [legIdxFiltered, legIdxSort]);

  const legIdxTopRows = useMemo(
    () => [...legIdxFiltered].sort((a, b) => (b.cases ?? 0) - (a.cases ?? 0)).slice(0, 15),
    [legIdxFiltered]
  );

  const linkedRecords = selected ? getLinkedForSelected(selected) : [];

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
          <div className="inc-view-toggle">
            <button className={`inc-view-tab${activeTab === 'network' ? ' inc-view-tab-active' : ''}`} onClick={() => setActiveTab('network')}>
              Network Map
            </button>
            <button className={`inc-view-tab${activeTab === 'legislationIndex' ? ' inc-view-tab-active' : ''}`} onClick={() => setActiveTab('legislationIndex')}>
              Legislation Index
            </button>
          </div>

          {activeTab === 'network' && (
            <div style={{ marginTop: '1.5rem' }}>
              <p className="db-note" style={{ textAlign: 'left', marginTop: 0, marginBottom: '1.25rem' }}>
                Every legislation, incident, case and cited source is plotted as a node, each database its own
                colour. Case-to-legislation edges are drawn from the case registers' own legislation mapping, so
                only cases and Acts that connect to a live Legislation Tracker entry are linked — the rest remain
                unlinked nodes. Source nodes are drawn from each incident's own source list (in the Incidents
                Tracker); click one to see its evidentiary type — News media, Government or official, Legal or NGO
                commentary, Academic commentary, The Conversation — using the same classing as the Case Tracker's
                Sources.
              </p>

              {mapSubView === 'graph' && (
                <>
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
                    <span className="db-count">{baseNodes.length.toLocaleString()} of {rawNodes.length.toLocaleString()} nodes</span>
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
                      <span className="leg-filter-label">Colour by</span>
                      <button className={`leg-pill${colourMode === 'database' ? ' leg-pill-active' : ''}`} onClick={() => setColourMode('database')}>Database</button>
                      <button className={`leg-pill${colourMode === 'caseType' ? ' leg-pill-active' : ''}`} onClick={() => setColourMode('caseType')}>Case type</button>
                      <span className="leg-filter-label" style={{ marginLeft: '1.5rem' }}>Size by</span>
                      {(Object.keys(SIZE_MODE_META) as SizeMode[]).map(sm => (
                        <button key={sm} className={`leg-pill${sizeMode === sm ? ' leg-pill-active' : ''}`} onClick={() => setSizeMode(sm)}>
                          {SIZE_MODE_META[sm]}
                        </button>
                      ))}
                    </div>
                    <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                      <span className="leg-filter-label">Layout</span>
                      {(Object.keys(LAYOUT_META) as LayoutAlgo[]).map(la => (
                        <button key={la} className={`leg-pill${layoutAlgo === la ? ' leg-pill-active' : ''}`} onClick={() => setLayoutAlgo(la)}>
                          {LAYOUT_META[la]}
                        </button>
                      ))}
                      <span className="leg-filter-label" style={{ marginLeft: '1.5rem' }}>Edges</span>
                      <button className={`leg-pill${showEdges ? ' leg-pill-active' : ''}`} onClick={() => setShowEdges(v => !v)}>
                        {showEdges ? `Shown (${graphEdges.length})` : 'Hidden'}
                      </button>
                      <button className="leg-pill" style={{ marginLeft: '0.75rem' }} onClick={() => graphCmdRef.current?.fitView()}>Fit view</button>
                    </div>
                    <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                      <span className="leg-filter-label">Repulsion</span>
                      <div className="inc-year-range" style={{ maxWidth: '220px' }}>
                        <input
                          type="range" min={0.4} max={2.5} step={0.1} value={repulsion}
                          onChange={e => setRepulsion(Number(e.target.value))}
                          disabled={layoutAlgo === 'circular'}
                        />
                        <span>{repulsion.toFixed(1)}×</span>
                      </div>
                      <span className="leg-filter-label" style={{ marginLeft: '1.5rem' }}>Year range</span>
                      <div className="inc-year-range">
                        <span>{yearFrom}</span>
                        <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={yearFrom}
                          onChange={e => setYearFrom(Math.min(Number(e.target.value), yearTo))} />
                        <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={yearTo}
                          onChange={e => setYearTo(Math.max(Number(e.target.value), yearFrom))} />
                        <span>{yearTo}</span>
                      </div>
                      {hasFilter && (
                        <button className="leg-pill" onClick={clearFilters} style={{ marginLeft: 'auto' }}>Clear ×</button>
                      )}
                    </div>
                  </div>

                  <p className="events-detail-note" style={{ marginBottom: '0.75rem' }}>
                    Scroll to zoom · drag the background to pan · drag a node to move it · "Select area" brushes a
                    group to highlight · right-click a node for quick actions · right-click a case or Act in the Edge
                    List to jump here.
                  </p>
                </>
              )}

              {mapSubView === 'edgelist' && (
                <>
                  <div className="db-toolbar" style={{ marginBottom: '1rem' }}>
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
                        placeholder="Search case or legislation name…"
                        value={edgeSearch}
                        onChange={e => setEdgeSearch(e.target.value)}
                      />
                    </div>
                    <span className="db-count">{edgeRows.length.toLocaleString()} of {edges.length.toLocaleString()} links</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {(['all', 'protest', 'political_violence'] as const).map(r => (
                      <button
                        key={r}
                        className={`leg-pill${edgeRegisterFilter === r ? ' leg-pill-active' : ''}`}
                        onClick={() => setEdgeRegisterFilter(r)}
                      >
                        {r === 'all' ? 'All' : CASE_REGISTER_META[r].label}
                      </button>
                    ))}
                  </div>
                  <p className="events-detail-note" style={{ marginBottom: '0.75rem' }}>
                    Right-click a case name, a legislation name, or the provision cell to jump to that record (or that
                    link) in the map view.
                  </p>
                </>
              )}

              <div className="cases-view-tabs" style={{ marginBottom: '1.25rem' }}>
                <button className={`cases-tab${mapSubView === 'graph' ? ' cases-tab-active' : ''}`} onClick={() => setMapSubView('graph')}>
                  Map
                </button>
                <button className={`cases-tab${mapSubView === 'edgelist' ? ' cases-tab-active' : ''}`} onClick={() => setMapSubView('edgelist')}>
                  Edge List
                </button>
              </div>

              {mapSubView === 'graph' && (
                <>
                  <div className="analytics-layout">
                    <div className="analytics-graph-wrapper">
                      <NetworkGraph
                        nodes={graphNodes}
                        edges={graphEdges}
                        height={GRAPH_HEIGHT}
                        layout={layoutAlgo}
                        sizeMode={sizeMode}
                        repulsion={debouncedRepulsion}
                        cmdRef={graphCmdRef}
                        onSelectNode={id => setSelectedId(id)}
                        onNodeContextMenu={handleNodeContextMenu}
                      />
                      <div className="cases-chart-legend" style={{ marginTop: '0.75rem' }}>
                        {(['legislation', 'incident'] as NodeType[]).map(t => (
                          <div key={t} className="cases-legend-item">
                            <span className="cases-legend-dot" style={{ background: TYPE_META[t].color }} />
                            {TYPE_META[t].label}
                          </div>
                        ))}
                        {colourMode === 'database' ? (
                          <div className="cases-legend-item">
                            <span className="cases-legend-dot" style={{ background: TYPE_META.case.color }} />
                            {TYPE_META.case.label}
                          </div>
                        ) : (
                          (Object.keys(CASE_REGISTER_META) as CaseRegister[]).map(r => (
                            <div key={r} className="cases-legend-item">
                              <span className="cases-legend-dot" style={{ background: CASE_REGISTER_META[r].color }} />
                              {CASE_REGISTER_META[r].label}
                            </div>
                          ))
                        )}
                        <div className="cases-legend-item">
                          <span className="cases-legend-dot" style={{ background: TYPE_META.source.color }} />
                          {TYPE_META.source.label}
                        </div>
                      </div>
                    </div>

                    <div className="analytics-detail-panel">
                      {selected ? (
                        <>
                          <span className="db-pill db-pill-active" style={{ background: nodeColour(selected), borderColor: nodeColour(selected), cursor: 'default' }}>
                            {selected.type === 'case' && selected.caseRegister
                              ? CASE_REGISTER_META[selected.caseRegister].label
                              : selected.type === 'source' && selected.sourceBucket
                                ? `Source · ${selected.sourceBucket}`
                                : TYPE_META[selected.type].label}
                          </span>
                          <h3 className="analytics-detail-title">{selected.label}</h3>
                          <p className="analytics-detail-sub">{selected.sub}</p>
                          {selected.year !== null && <p className="analytics-detail-sub">Year: {selected.year}</p>}
                          {selected.type === 'source' && selected.summary && (
                            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{selected.summary}</p>
                          )}
                          {selected.url && (
                            <p style={{ marginTop: '0.75rem' }}>
                              <a href={selected.url} target="_blank" rel="noopener noreferrer" className="db-link">View source ↗</a>
                            </p>
                          )}
                          {linkedRecords.length === 0 ? (
                            <p className="events-detail-note" style={{ marginTop: '1.25rem' }}>
                              No linked records for this node.
                            </p>
                          ) : (
                            <>
                              <div className="events-detail-h4" style={{ marginTop: '1.25rem' }}>
                                Linked records ({linkedRecords.length})
                              </div>
                              <ul className="events-plain-list">
                                {linkedRecords.slice(0, 8).map((r, i) => (
                                  <li key={i}>
                                    {r.label}
                                    {r.note && <span className="events-detail-note"> — {r.note}</span>}
                                  </li>
                                ))}
                              </ul>
                              {linkedRecords.length > 8 && (
                                <p className="events-detail-note">and {linkedRecords.length - 8} more.</p>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                          Click a node to see its details.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {mapSubView === 'edgelist' && (
                <>
                  <div className="db-table-wrapper" style={{ maxHeight: '560px', overflowY: 'auto' }}>
                    <table className="db-table">
                      <thead>
                        <tr>
                          <th className="db-th">Case</th>
                          <th className="db-th">Register</th>
                          <th className="db-th">Legislation</th>
                          <th className="db-th">Provision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {edgeRows.map((e, i) => {
                          const c = caseById.get(e.case_id);
                          const l = legislationById.get(e.legislation_id);
                          return (
                            <tr key={i} className="db-row">
                              <td
                                className="db-td db-td-name"
                                onContextMenu={ev => {
                                  ev.preventDefault();
                                  setContextMenu({ x: ev.clientX, y: ev.clientY, actions: [{ label: 'Show case in map view', onClick: () => showNodeInMap(e.case_id) }] });
                                }}
                              >
                                {c?.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c?.case_name ?? e.case_id}</a> : (c?.case_name ?? e.case_id)}
                              </td>
                              <td className="db-td">
                                <span className="events-status-pill" style={{ background: CASE_REGISTER_META[e.register].color + '22', color: CASE_REGISTER_META[e.register].color }}>
                                  {CASE_REGISTER_META[e.register].label}
                                </span>
                              </td>
                              <td
                                className="db-td db-td-name"
                                onContextMenu={ev => {
                                  ev.preventDefault();
                                  setContextMenu({ x: ev.clientX, y: ev.clientY, actions: [{ label: 'Show legislation in map view', onClick: () => showNodeInMap(e.legislation_id) }] });
                                }}
                              >
                                {l ? <a href={l.url} target="_blank" rel="noopener noreferrer">{l.short_title} ↗</a> : e.legislation_id}
                              </td>
                              <td
                                className="db-td db-td-muted"
                                style={{ fontSize: '0.85rem' }}
                                onContextMenu={ev => {
                                  ev.preventDefault();
                                  setContextMenu({ x: ev.clientX, y: ev.clientY, actions: [{ label: 'Show edge in map view', onClick: () => showEdgeInMap(e.case_id, e.legislation_id) }] });
                                }}
                              >
                                {e.provision ?? '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'legislationIndex' && (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Every provision or instrument identified across both case registers, ranked by how many cases cite
                it. This is a derived usage metric from the case data, not the Legislation Tracker's own content —
                only rows resolved to a tracker entry (marked below) link out to it.
              </p>

              <div className="db-toolbar" style={{ marginBottom: '1rem' }}>
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
                    placeholder="Search Act or instrument name…"
                    value={legIdxSearch}
                    onChange={e => setLegIdxSearch(e.target.value)}
                  />
                </div>
                <span className="db-count">{legIdxSorted.length.toLocaleString()} of {legIndex.length.toLocaleString()} provisions</span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {(['all', 'protest', 'political_violence'] as const).map(r => (
                  <button
                    key={r}
                    className={`leg-pill${legIdxRegister === r ? ' leg-pill-active' : ''}`}
                    onClick={() => setLegIdxRegister(r)}
                  >
                    {r === 'all' ? 'All' : CASE_REGISTER_META[r].label}
                  </button>
                ))}
              </div>

              <div className="cases-view-tabs" style={{ marginBottom: '1.25rem' }}>
                <button className={`cases-tab${legIdxView === 'visualise' ? ' cases-tab-active' : ''}`} onClick={() => setLegIdxView('visualise')}>
                  Visualise
                </button>
                <button className={`cases-tab${legIdxView === 'data' ? ' cases-tab-active' : ''}`} onClick={() => setLegIdxView('data')}>
                  Data
                </button>
              </div>

              {legIdxView === 'visualise' ? (
                <>
                  <p className="events-detail-note" style={{ marginBottom: '0.75rem' }}>
                    Top {legIdxTopRows.length} provisions by case count, within the current search and register
                    filter. Click a bar to open its Legislation Tracker entry where one is resolved.
                  </p>
                  <LegislationIndexChart rows={legIdxTopRows} legislationById={legislationById} />
                </>
              ) : (
                <div className="db-table-wrapper">
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th className="db-th db-th-sortable" onClick={() => setLegIdxSort('name')}>Act / instrument</th>
                        <th className="db-th">Category</th>
                        <th className="db-th">Register</th>
                        <th className="db-th db-th-sortable" onClick={() => setLegIdxSort('cases')}>Cases</th>
                        <th className="db-th db-th-sortable" onClick={() => setLegIdxSort('latest_year')}>Year range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legIdxSorted.slice(0, 60).map((r, i) => {
                        const linkedEntry = r.legislation_id ? legislationById.get(r.legislation_id) : undefined;
                        return (
                          <tr key={i} className="db-row">
                            <td className="db-td db-td-name">
                              {linkedEntry ? (
                                <a href={linkedEntry.url} target="_blank" rel="noopener noreferrer">{r.name} ↗</a>
                              ) : r.name}
                              {r.provision && <div className="events-detail-note">{r.provision}</div>}
                            </td>
                            <td className="db-td db-td-muted" style={{ fontSize: '0.82rem' }}>{r.category ?? '—'}</td>
                            <td className="db-td">
                              <span className="events-status-pill" style={{ background: CASE_REGISTER_META[r.register].color + '22', color: CASE_REGISTER_META[r.register].color }}>
                                {CASE_REGISTER_META[r.register].label}
                              </span>
                            </td>
                            <td className="db-td">{r.cases}</td>
                            <td className="db-td db-td-muted" style={{ fontSize: '0.85rem' }}>
                              {r.earliest_year && r.latest_year ? `${r.earliest_year}–${r.latest_year}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {legIdxSorted.length > 60 && (
                    <p className="events-detail-note" style={{ marginTop: '0.75rem' }}>
                      Showing the top 60 of {legIdxSorted.length} — narrow with search or the register filter to see more.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 2000,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', minWidth: '200px',
          }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.actions.map((a, i) => (
            <button
              key={i}
              onClick={() => { a.onClick(); setContextMenu(null); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 1rem',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-warm)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
