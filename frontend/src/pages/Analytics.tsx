import { useEffect, useMemo, useRef, useState } from 'react';
import legislationData from '../data/legislation_tracker.json';
import incidentsData from '../data/incidents_tracker.json';
import casesData from '../data/cases.json';
import edgesData from '../data/case_legislation_edges.json';
import legIndexData from '../data/legislation_index.json';

type NodeType = 'legislation' | 'incident' | 'case';
type CaseRegister = 'protest' | 'political_violence';
type LayoutAlgo = 'clustered' | 'force' | 'circular';
type AnalyticsTab = 'network' | 'legislationIndex';
type MapSubView = 'graph' | 'edgelist';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  sub: string;
  year: number | null;
  weight: number;
  url?: string;
  caseRegister?: CaseRegister;
}

interface LaidOutNode extends GraphNode {
  x: number;
  y: number;
}

const TYPE_META: Record<NodeType, { label: string; color: string }> = {
  legislation: { label: 'Legislation', color: '#1d3a5c' },
  incident: { label: 'Incidents', color: '#dc2626' },
  case: { label: 'Cases', color: '#8b5cf6' },
};

const CASE_REGISTER_META: Record<CaseRegister, { label: string; color: string }> = {
  protest: { label: 'Protest cases', color: '#0d9488' },
  political_violence: { label: 'Political violence cases', color: '#dc2626' },
};

const LAYOUT_META: Record<LayoutAlgo, string> = {
  clustered: 'Clustered by database',
  force: 'Force-directed (by edges)',
  circular: 'Circular',
};

const WIDTH = 1100;
const HEIGHT = 680;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;

const CENTERS: Record<NodeType, { x: number; y: number }> = {
  legislation: { x: WIDTH * 0.25, y: HEIGHT * 0.3 },
  incident: { x: WIDTH * 0.75, y: HEIGHT * 0.3 },
  case: { x: WIDTH * 0.5, y: HEIGHT * 0.8 },
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function nodeRadius(): number {
  return 6;
}

function clampToCanvas(p: { x: number; y: number }): { x: number; y: number } {
  const r = nodeRadius();
  return { x: Math.min(WIDTH - r, Math.max(r, p.x)), y: Math.min(HEIGHT - r, Math.max(r, p.y)) };
}

/** Clustered: repel overlapping nodes, pull each toward its type's quadrant centre. */
function layoutClustered(nodes: GraphNode[]): LaidOutNode[] {
  const pts: LaidOutNode[] = nodes.map(n => {
    const seed = hashStr(n.id);
    const c = CENTERS[n.type];
    const jx = (seed % 260) - 130;
    const jy = (Math.floor(seed / 260) % 260) - 130;
    return { ...n, x: c.x + jx, y: c.y + jy };
  });
  for (let iter = 0; iter < 50; iter++) {
    repel(pts);
    for (const p of pts) {
      const c = CENTERS[p.type];
      p.x += (c.x - p.x) * 0.025;
      p.y += (c.y - p.y) * 0.025;
      const clamped = clampToCanvas(p);
      p.x = clamped.x; p.y = clamped.y;
    }
  }
  return pts;
}

/** Circular: one ring, nodes grouped into contiguous arcs by database. */
function layoutCircular(nodes: GraphNode[]): LaidOutNode[] {
  const order: NodeType[] = ['legislation', 'incident', 'case'];
  const grouped = order.flatMap(t => nodes.filter(n => n.type === t));
  const cx = WIDTH / 2, cy = HEIGHT / 2;
  const r = Math.min(WIDTH, HEIGHT) / 2 - 40;
  return grouped.map((n, i) => {
    const angle = (i / grouped.length) * Math.PI * 2 - Math.PI / 2;
    return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

/** Force-directed: pure repulsion plus a spring pull along real case-to-legislation
 * edges, so connected cases and Acts drift toward each other. No fixed per-type
 * centres — nodes with no edges just settle wherever repulsion leaves them. */
function layoutForce(nodes: GraphNode[], edgePairs: [number, number][]): LaidOutNode[] {
  const pts: LaidOutNode[] = nodes.map(n => {
    const seed = hashStr(n.id);
    return { ...n, x: ((seed % 997) / 997) * WIDTH, y: ((Math.floor(seed / 997) % 997) / 997) * HEIGHT };
  });
  for (let iter = 0; iter < 50; iter++) {
    repel(pts);
    for (const [ai, bi] of edgePairs) {
      const a = pts[ai], b = pts[bi];
      let dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist - 70) * 0.03;
      dx /= dist; dy /= dist;
      a.x += dx * force; a.y += dy * force;
      b.x -= dx * force; b.y -= dy * force;
    }
    for (const p of pts) {
      p.x += (WIDTH / 2 - p.x) * 0.006;
      p.y += (HEIGHT / 2 - p.y) * 0.006;
      const clamped = clampToCanvas(p);
      p.x = clamped.x; p.y = clamped.y;
    }
  }
  return pts;
}

function repel(pts: LaidOutNode[]) {
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const minDist = nodeRadius() * 2 + 4;
      if (dist < minDist) {
        const push = (minDist - dist) / 2;
        dx /= dist; dy /= dist;
        a.x += dx * push; a.y += dy * push;
        b.x -= dx * push; b.y -= dy * push;
      }
    }
  }
}

type LegEntry = { id: string; short_title: string; jurisdiction: string; year: number; url: string };
type LegCategory = { id: string; label: string; entries: LegEntry[] };
type IncidentMini = { id: string; short_title: string; location: string; year: number };
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

const rawNodes: GraphNode[] = [
  ...legislationCategories.flatMap(cat =>
    cat.entries.map(e => ({
      id: e.id, type: 'legislation' as const, label: e.short_title,
      sub: `${e.jurisdiction} · ${cat.label}`, year: e.year, weight: 1, url: e.url,
    }))
  ),
  ...incidentsList.map(i => ({
    id: i.id, type: 'incident' as const, label: i.short_title,
    sub: i.location, year: i.year, weight: 1,
  })),
  ...casesList.map(c => ({
    id: c.id, type: 'case' as const, label: c.case_name,
    sub: c.jurisdiction_display ?? 'Jurisdiction not identified', year: c.year, weight: 1,
    url: c.url ?? undefined, caseRegister: c.register,
  })),
];

const nodeIndexById = new Map(rawNodes.map((n, i) => [n.id, i]));
const forceEdgePairs: [number, number][] = edges
  .map(e => [nodeIndexById.get(e.case_id), nodeIndexById.get(e.legislation_id)])
  .filter((p): p is [number, number] => p[0] !== undefined && p[1] !== undefined);

const ALL_YEARS = [
  ...legislationCategories.flatMap(c => c.entries.map(e => e.year)),
  ...incidentsList.map(i => i.year),
  ...casesList.map(c => c.year),
].sort((a, b) => a - b);
const MIN_YEAR = ALL_YEARS[0];
const MAX_YEAR = ALL_YEARS[ALL_YEARS.length - 1];

type ContextMenuState = { x: number; y: number; actions: { label: string; onClick: () => void }[] };

type InteractionState = {
  mode: 'none' | 'pan' | 'node';
  nodeId?: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  moved: boolean;
};

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('network');
  const [mapSubView, setMapSubView] = useState<MapSubView>('graph');
  const [layoutAlgo, setLayoutAlgo] = useState<LayoutAlgo>('clustered');

  const [typeVisible, setTypeVisible] = useState<Record<NodeType, boolean>>({
    legislation: true, incident: true, case: true,
  });
  const [colourMode, setColourMode] = useState<'database' | 'caseType'>('database');
  const [showEdges, setShowEdges] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFrom, setYearFrom] = useState(MIN_YEAR);
  const [yearTo, setYearTo] = useState(MAX_YEAR);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [highlightedEdgeKey, setHighlightedEdgeKey] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const interactionRef = useRef<InteractionState>({ mode: 'none', startClientX: 0, startClientY: 0, startX: 0, startY: 0, moved: false });

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [edgeSearch, setEdgeSearch] = useState('');
  const [edgeRegisterFilter, setEdgeRegisterFilter] = useState<'all' | CaseRegister>('all');

  const [legIdxSearch, setLegIdxSearch] = useState('');
  const [legIdxRegister, setLegIdxRegister] = useState<'all' | CaseRegister>('all');
  const [legIdxSort, setLegIdxSort] = useState<'cases' | 'name' | 'latest_year'>('cases');

  const laidOut = useMemo(() => {
    if (layoutAlgo === 'clustered') return layoutClustered(rawNodes);
    if (layoutAlgo === 'circular') return layoutCircular(rawNodes);
    return layoutForce(rawNodes, forceEdgePairs);
  }, [layoutAlgo]);

  function resetLayout(next: LayoutAlgo) {
    setLayoutAlgo(next);
    setPositionOverrides({});
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  const positioned = useMemo(
    () => laidOut.map(n => positionOverrides[n.id] ? { ...n, ...positionOverrides[n.id] } : n),
    [laidOut, positionOverrides]
  );
  const nodeById = useMemo(() => new Map(positioned.map(n => [n.id, n])), [positioned]);

  const typeCounts = useMemo(() => {
    const counts: Record<NodeType, number> = { legislation: 0, incident: 0, case: 0 };
    for (const n of rawNodes) counts[n.type]++;
    return counts;
  }, []);

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
    setTypeVisible({ legislation: true, incident: true, case: true });
  }

  const visibleCount = positioned.filter(isMatch).length;

  function nodeColour(n: GraphNode): string {
    if (colourMode === 'caseType' && n.type === 'case' && n.caseRegister) {
      return CASE_REGISTER_META[n.caseRegister].color;
    }
    return TYPE_META[n.type].color;
  }

  const visibleEdges = useMemo(() => {
    if (!showEdges) return [];
    return edges
      .map(e => ({ e, from: nodeById.get(e.case_id), to: nodeById.get(e.legislation_id) }))
      .filter((x): x is { e: CaseLegislationEdge; from: LaidOutNode; to: LaidOutNode } =>
        !!x.from && !!x.to && isMatch(x.from) && isMatch(x.to)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEdges, nodeById, typeVisible, yearFrom, yearTo, q]);

  // --- Pan / zoom / drag ---
  function svgScale(): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 1;
    return WIDTH / rect.width;
  }

  function handleBackgroundMouseDown(e: React.MouseEvent) {
    interactionRef.current = { mode: 'pan', startClientX: e.clientX, startClientY: e.clientY, startX: pan.x, startY: pan.y, moved: false };
    setContextMenu(null);
  }

  function handleNodeMouseDown(e: React.MouseEvent, node: LaidOutNode) {
    e.stopPropagation();
    interactionRef.current = { mode: 'node', nodeId: node.id, startClientX: e.clientX, startClientY: e.clientY, startX: node.x, startY: node.y, moved: false };
  }

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      const s = interactionRef.current;
      if (s.mode === 'none') return;
      const dxScreen = e.clientX - s.startClientX;
      const dyScreen = e.clientY - s.startClientY;
      if (Math.abs(dxScreen) > 2 || Math.abs(dyScreen) > 2) s.moved = true;
      const scale = svgScale();
      if (s.mode === 'pan') {
        setPan({ x: s.startX + dxScreen * scale, y: s.startY + dyScreen * scale });
      } else if (s.mode === 'node' && s.nodeId) {
        const dxSvg = (dxScreen * scale) / zoom;
        const dySvg = (dyScreen * scale) / zoom;
        setPositionOverrides(prev => ({ ...prev, [s.nodeId as string]: { x: s.startX + dxSvg, y: s.startY + dySvg } }));
      }
    }
    function handleUp() {
      interactionRef.current = { ...interactionRef.current, mode: 'none' };
    }
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [zoom]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const scale = WIDTH / rect.width;
      const svgX = (e.clientX - rect.left) * scale;
      const svgY = (e.clientY - rect.top) * scale;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
      const worldX = (svgX - pan.x) / zoom;
      const worldY = (svgY - pan.y) / zoom;
      setZoom(newZoom);
      setPan({ x: svgX - worldX * newZoom, y: svgY - worldY * newZoom });
    }
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoom, pan]);

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function revealNode(node: GraphNode) {
    setTypeVisible(prev => ({ ...prev, [node.type]: true }));
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
    setHighlightedEdgeKey(null);
    setSelected(node);
    setZoom(1.6);
    setPan({ x: WIDTH / 2 - node.x * 1.6, y: HEIGHT / 2 - node.y * 1.6 });
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
    setSelected(null);
    setHighlightedEdgeKey(`${caseId}-${legislationId}`);
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    setZoom(1.6);
    setPan({ x: WIDTH / 2 - midX * 1.6, y: HEIGHT / 2 - midY * 1.6 });
    setContextMenu(null);
  }

  useEffect(() => {
    function dismiss() { setContextMenu(null); }
    document.addEventListener('click', dismiss);
    return () => document.removeEventListener('click', dismiss);
  }, []);

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
                Every legislation, incident and case record plotted as a node, clustered by database. Case-to-legislation
                edges are drawn from the case registers' own legislation mapping, so only cases and Acts that connect to
                a live Legislation Tracker entry are linked — the rest remain unlinked nodes. News media coverage is not
                currently included in this map.
              </p>

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
                      <span className="leg-filter-label">Colour by</span>
                      <button className={`leg-pill${colourMode === 'database' ? ' leg-pill-active' : ''}`} onClick={() => setColourMode('database')}>Database</button>
                      <button className={`leg-pill${colourMode === 'caseType' ? ' leg-pill-active' : ''}`} onClick={() => setColourMode('caseType')}>Case type</button>
                      <span className="leg-filter-label" style={{ marginLeft: '1.5rem' }}>Edges</span>
                      <button className={`leg-pill${showEdges ? ' leg-pill-active' : ''}`} onClick={() => setShowEdges(v => !v)}>
                        {showEdges ? `Shown (${visibleEdges.length})` : 'Hidden'}
                      </button>
                    </div>
                    <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                      <span className="leg-filter-label">Layout</span>
                      {(Object.keys(LAYOUT_META) as LayoutAlgo[]).map(la => (
                        <button key={la} className={`leg-pill${layoutAlgo === la ? ' leg-pill-active' : ''}`} onClick={() => resetLayout(la)}>
                          {LAYOUT_META[la]}
                        </button>
                      ))}
                      <span className="leg-filter-label" style={{ marginLeft: '1.5rem' }}>Zoom {Math.round(zoom * 100)}%</span>
                      <button className="leg-pill" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.25))}>+</button>
                      <button className="leg-pill" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.25))}>−</button>
                      <button className="leg-pill" onClick={resetView}>Reset view</button>
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
                      {hasFilter && (
                        <button className="leg-pill" onClick={clearFilters} style={{ marginLeft: 'auto' }}>Clear ×</button>
                      )}
                    </div>
                  </div>

                  <p className="events-detail-note" style={{ marginBottom: '0.75rem' }}>
                    Scroll to zoom · drag the background to pan · drag a node to move it · right-click a case or Act in
                    the Edge List to jump here.
                  </p>

                  <div className="analytics-layout">
                    <div className="analytics-graph-wrapper">
                      <svg
                        ref={svgRef}
                        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                        className="analytics-graph-svg"
                        role="img"
                        aria-label="Network map of legislation, incidents and cases"
                        style={{ cursor: 'grab', touchAction: 'none' }}
                        onMouseDown={handleBackgroundMouseDown}
                      >
                        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                          {visibleEdges.map(({ e, from, to }, i) => {
                            const key = `${e.case_id}-${e.legislation_id}`;
                            const isHighlighted = highlightedEdgeKey === key;
                            return (
                              <line
                                key={`${key}-${i}`}
                                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                                stroke={CASE_REGISTER_META[e.register].color}
                                strokeOpacity={isHighlighted ? 0.9 : 0.16}
                                strokeWidth={isHighlighted ? 2.5 / zoom : 1 / zoom}
                              />
                            );
                          })}
                          {positioned.map(n => {
                            const visible = isMatch(n);
                            const isSelected = selected?.id === n.id;
                            return (
                              <circle
                                key={n.id}
                                cx={n.x}
                                cy={n.y}
                                r={nodeRadius()}
                                fill={nodeColour(n)}
                                opacity={visible ? (isSelected ? 1 : 0.85) : 0.08}
                                stroke={isSelected ? 'var(--color-text)' : 'var(--color-surface)'}
                                strokeWidth={(isSelected ? 2.5 : 1.5) / zoom}
                                style={{ cursor: visible ? 'grab' : 'default', transition: 'opacity 0.2s' }}
                                onMouseDown={e => visible && handleNodeMouseDown(e, n)}
                                onClick={() => {
                                  if (interactionRef.current.moved) return;
                                  if (!visible) return;
                                  setSelected(n);
                                  setHighlightedEdgeKey(null);
                                }}
                              >
                                <title>{n.label} — {TYPE_META[n.type].label}</title>
                              </circle>
                            );
                          })}
                        </g>
                      </svg>
                      <div className="cases-chart-legend" style={{ marginTop: '0.75rem' }}>
                        {colourMode === 'database'
                          ? (Object.keys(TYPE_META) as NodeType[]).map(t => (
                            <div key={t} className="cases-legend-item">
                              <span className="cases-legend-dot" style={{ background: TYPE_META[t].color }} />
                              {TYPE_META[t].label}
                            </div>
                          ))
                          : (
                            <>
                              {(['legislation', 'incident'] as NodeType[]).map(t => (
                                <div key={t} className="cases-legend-item">
                                  <span className="cases-legend-dot" style={{ background: TYPE_META[t].color }} />
                                  {TYPE_META[t].label}
                                </div>
                              ))}
                              {(Object.keys(CASE_REGISTER_META) as CaseRegister[]).map(r => (
                                <div key={r} className="cases-legend-item">
                                  <span className="cases-legend-dot" style={{ background: CASE_REGISTER_META[r].color }} />
                                  {CASE_REGISTER_META[r].label}
                                </div>
                              ))}
                            </>
                          )}
                      </div>
                    </div>

                    <div className="analytics-detail-panel">
                      {selected ? (
                        <>
                          <span className="db-pill db-pill-active" style={{ background: nodeColour(selected), borderColor: nodeColour(selected), cursor: 'default' }}>
                            {selected.type === 'case' && selected.caseRegister ? CASE_REGISTER_META[selected.caseRegister].label : TYPE_META[selected.type].label}
                          </span>
                          <h3 className="analytics-detail-title">{selected.label}</h3>
                          <p className="analytics-detail-sub">{selected.sub}</p>
                          {selected.year !== null && <p className="analytics-detail-sub">Year: {selected.year}</p>}
                          {selected.url && (
                            <p style={{ marginTop: '0.75rem' }}>
                              <a href={selected.url} target="_blank" rel="noopener noreferrer" className="db-link">View source ↗</a>
                            </p>
                          )}
                          {(() => {
                            const linked = edges.filter(e => e.case_id === selected.id || e.legislation_id === selected.id);
                            if (linked.length === 0) {
                              return (
                                <p className="events-detail-note" style={{ marginTop: '1.25rem' }}>
                                  No linked records for this node in the case-to-legislation mapping.
                                </p>
                              );
                            }
                            return (
                              <>
                                <div className="events-detail-h4" style={{ marginTop: '1.25rem' }}>
                                  Linked records ({linked.length})
                                </div>
                                <ul className="events-plain-list">
                                  {linked.slice(0, 8).map((e, i) => {
                                    const otherId = e.case_id === selected.id ? e.legislation_id : e.case_id;
                                    const other = nodeById.get(otherId);
                                    if (!other) return null;
                                    return (
                                      <li key={i}>
                                        {other.label}
                                        {e.provision && <span className="events-detail-note"> — {e.provision}</span>}
                                      </li>
                                    );
                                  })}
                                </ul>
                                {linked.length > 8 && (
                                  <p className="events-detail-note">and {linked.length - 8} more.</p>
                                )}
                              </>
                            );
                          })()}
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
