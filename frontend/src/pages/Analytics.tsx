import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import legislationData from '../data/legislation_tracker.json';
import incidentsData from '../data/incidents_tracker.json';
import casesData from '../data/cases.json';
import edgesData from '../data/case_legislation_edges.json';
import legIndexData from '../data/legislation_index.json';
import NetworkGraph, { type NetworkGraphHandle, type LayoutAlgo, type SizeMode } from '../components/NetworkGraph';
import GeoMap, { joinCasesToStates, type GeoCase, type GeoStateSelection } from '../components/GeoMap';
import Timeline, { type TimelineHandle, type TimelineSelection, type TimelineType } from '../components/Timeline';
import CategoryMultiSelect, { type CategoryOption } from '../components/CategoryMultiSelect';
import { buildCategoryColourScale } from '../lib/categoryColors';
import { normalizeSourceType, type SourceTypeLabel } from '../lib/sourceTypes';

type NodeType = 'legislation' | 'incident' | 'case' | 'source';
type CaseRegister = 'protest' | 'political_violence';
type AnalyticsTab = 'network' | 'legislationIndex' | 'geoMap' | 'timeline';
type MapSubView = 'graph' | 'edgelist';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  sub: string;
  year: number | null;
  url?: string;
  caseRegister?: CaseRegister;
  category?: string | null;
  sourceBucket?: SourceTypeLabel;
  summary?: string;
}

// Single source of truth for database/register colours across every Analytics
// visualisation (Network Map, Geographic Map, Timeline, Legislation Index) —
// GeoMap and Timeline receive these as props rather than defining their own,
// so any change here stays consistent everywhere. Kept clear of each other:
// incident (amber) must not collide with political-violence (red), which is
// why it isn't red too, despite that being a more "obvious" incident colour.
const TYPE_META: Record<NodeType, { label: string; color: string }> = {
  legislation: { label: 'Legislation', color: '#1d3a5c' },
  incident: { label: 'Incidents', color: '#d97706' },
  case: { label: 'Cases', color: '#8b5cf6' },
  source: { label: 'Sources', color: '#6b7280' },
};

const CASE_REGISTER_META: Record<CaseRegister, { label: string; color: string }> = {
  protest: { label: 'Protest cases', color: '#0d9488' },
  political_violence: { label: 'Political violence cases', color: '#dc2626' },
};

const SOURCE_EDGE_COLOUR = '#94a3b8';
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
  movement_group?: string | null; ideology_group?: string | null;
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

// The umbrella category for a case: movement group for protest, ideology
// group for political violence — the two taxonomies from the reviewed tag
// normalization. Detail-level tags (37/26 values) are too granular to be
// useful as a colour/filter dimension, so only the group level is surfaced.
function caseCategory(c: CaseMini): string | null {
  return (c.register === 'protest' ? c.movement_group : c.ideology_group) ?? null;
}

const PROTEST_CATEGORY_OPTIONS: CategoryOption[] = [...new Set(
  casesList.filter(c => c.register === 'protest').map(c => c.movement_group).filter((v): v is string => !!v)
)].sort().map(v => ({ value: v, label: v, group: 'Protest movement' }));

const POLITICAL_VIOLENCE_CATEGORY_OPTIONS: CategoryOption[] = [...new Set(
  casesList.filter(c => c.register === 'political_violence').map(c => c.ideology_group).filter((v): v is string => !!v)
)].sort().map(v => ({ value: v, label: v, group: 'Political violence ideology' }));

const ALL_CATEGORY_OPTIONS: CategoryOption[] = [...PROTEST_CATEGORY_OPTIONS, ...POLITICAL_VIOLENCE_CATEGORY_OPTIONS];

const CATEGORY_COLOUR = buildCategoryColourScale(ALL_CATEGORY_OPTIONS.map(o => o.value));

const LEGISLATION_REGISTRY_LABELS: Record<string, string> = {
  'www.legislation.gov.au': 'Federal Register of Legislation',
  'www.legislation.vic.gov.au': 'Victorian Legislation Register',
  'legislation.nsw.gov.au': 'NSW Legislation',
  'www.legislation.tas.gov.au': 'Tasmanian Legislation',
  'www.legislation.qld.gov.au': 'Queensland Legislation',
  'www.legislation.sa.gov.au': 'South Australian Legislation',
  'www.legislation.wa.gov.au': 'WA Legislation',
  'www.legislation.act.gov.au': 'ACT Legislation Register',
  'legislation.nt.gov.au': 'NT Legislation',
  'www.parliament.wa.gov.au': 'WA Parliament',
  'www.parliament.nsw.gov.au': 'NSW Parliament',
  'www.aph.gov.au': 'Australian Parliament House',
};

function legislationSourceLabel(url: string): string {
  try {
    return LEGISLATION_REGISTRY_LABELS[new URL(url).hostname] ?? 'Official legislation text';
  } catch {
    return 'Official legislation text';
  }
}

const incidentSourceEdges: { incidentId: string; sourceId: string }[] = [];
const legislationSourceEdges: { legislationId: string; sourceId: string }[] = [];
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
legislationCategories.forEach(cat => {
  cat.entries.forEach(e => {
    if (!e.url) return;
    const id = `source_leg_${e.id}`;
    sourceNodes.push({
      id, type: 'source', label: legislationSourceLabel(e.url), sub: `Official text · ${e.jurisdiction}`,
      year: e.year, url: e.url, sourceBucket: 'Government or official',
    });
    legislationSourceEdges.push({ legislationId: e.id, sourceId: id });
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
    url: c.url ?? undefined, caseRegister: c.register, category: caseCategory(c),
  })),
  ...sourceNodes,
];

const nodeById = new Map(rawNodes.map(n => [n.id, n]));

type CombinedEdge = { from: string; to: string; colour: string };
const combinedEdges: CombinedEdge[] = [
  ...edges.map(e => ({ from: e.case_id, to: e.legislation_id, colour: CASE_REGISTER_META[e.register].color })),
  ...incidentSourceEdges.map(e => ({ from: e.incidentId, to: e.sourceId, colour: SOURCE_EDGE_COLOUR })),
  ...legislationSourceEdges.map(e => ({ from: e.legislationId, to: e.sourceId, colour: SOURCE_EDGE_COLOUR })),
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

function TimelineSparkline({ data, colour }: { data: { year: number; count: number }[]; colour: string }) {
  if (data.length === 0) return null;
  const w = 240, h = 70, pad = 4, axisH = 12;
  const minYear = data[0].year;
  const maxYear = data[data.length - 1].year;
  const yearSpan = Math.max(1, maxYear - minYear);
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const innerW = w - pad * 2;
  const barW = Math.max(2, innerW / (yearSpan + 1) - 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {data.map((d, i) => {
        const x = pad + ((d.year - minYear) / yearSpan) * (innerW - barW);
        const barH = (d.count / maxCount) * (h - pad - axisH);
        return <rect key={i} x={x} y={h - axisH - barH} width={barW} height={Math.max(1, barH)} fill={colour} rx={1} />;
      })}
      <text x={pad} y={h - 2} fontSize="9" fill="var(--color-text-muted)">{minYear}</text>
      <text x={w - pad} y={h - 2} fontSize="9" fill="var(--color-text-muted)" textAnchor="end">{maxYear}</text>
    </svg>
  );
}

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('network');
  const [mapSubView, setMapSubView] = useState<MapSubView>('graph');

  const [typeVisible, setTypeVisible] = useState<Record<NodeType, boolean>>({
    legislation: true, incident: true, case: true, source: true,
  });
  const [caseRegisterVisible, setCaseRegisterVisible] = useState<Record<CaseRegister, boolean>>({
    protest: true, political_violence: true,
  });
  const [colourMode, setColourMode] = useState<'database' | 'caseType' | 'category'>('database');
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [sizeMode, setSizeMode] = useState<SizeMode>('degree');
  const [layoutAlgo, setLayoutAlgo] = useState<LayoutAlgo>('force');
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
  const [legIdxRegister, setLegIdxRegister] = useState<CaseRegister>('protest');
  const [legIdxSort, setLegIdxSort] = useState<'cases' | 'name' | 'latest_year'>('cases');
  const [legIdxView, setLegIdxView] = useState<'visualise' | 'data'>('visualise');

  // --- Geographic map ---
  const [geoYearFrom, setGeoYearFrom] = useState(MIN_YEAR);
  const [geoYearTo, setGeoYearTo] = useState(MAX_YEAR);
  const [geoRegisterVisible, setGeoRegisterVisible] = useState<Record<CaseRegister, boolean>>({
    protest: true, political_violence: true,
  });
  const [geoCategoryFilter, setGeoCategoryFilter] = useState<Set<string>>(new Set());
  const [geoSelected, setGeoSelected] = useState<GeoStateSelection | null>(null);

  // --- Timeline ---
  const [tlSearch, setTlSearch] = useState('');
  const debouncedTlSearch = useDebouncedValue(tlSearch.trim().toLowerCase(), 300);
  const [tlYearFrom, setTlYearFrom] = useState(MIN_YEAR);
  const [tlYearTo, setTlYearTo] = useState(MAX_YEAR);
  const [tlTypeVisible, setTlTypeVisible] = useState<Record<TimelineType, boolean>>({
    legislation: true, incident: true, case: true,
  });
  const [tlRegisterVisible, setTlRegisterVisible] = useState<Record<CaseRegister, boolean>>({
    protest: true, political_violence: true,
  });
  const [tlCategoryFilter, setTlCategoryFilter] = useState<Set<string>>(new Set());
  const [tlSelected, setTlSelected] = useState<TimelineSelection | null>(null);
  const tlCmdRef = useRef<TimelineHandle | null>(null);

  function nodeColour(n: GraphNode): string {
    if (colourMode === 'category' && n.type === 'case' && n.category) {
      return CATEGORY_COLOUR.get(n.category) ?? TYPE_META[n.type].color;
    }
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
      if (n.type === 'case' && n.caseRegister && !caseRegisterVisible[n.caseRegister]) return false;
      if (n.type === 'case' && categoryFilter.size > 0 && !(n.category && categoryFilter.has(n.category))) return false;
      if (n.year !== null && (n.year < yearFrom || n.year > yearTo)) return false;
      if (debouncedSearch && !n.label.toLowerCase().includes(debouncedSearch) && !n.sub.toLowerCase().includes(debouncedSearch)) return false;
      return true;
    });
  }, [typeVisible, caseRegisterVisible, categoryFilter, yearFrom, yearTo, debouncedSearch]);

  const baseNodeIds = useMemo(() => new Set(baseNodes.map(n => n.id)), [baseNodes]);

  const presentCategories = useMemo(
    () => [...new Set(baseNodes.filter(n => n.type === 'case' && n.category).map(n => n.category as string))].sort(),
    [baseNodes]
  );

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
    Object.values(typeVisible).some(v => !v) || Object.values(caseRegisterVisible).some(v => !v) ||
    categoryFilter.size > 0;

  function toggleType(t: NodeType) {
    setTypeVisible(prev => ({ ...prev, [t]: !prev[t] }));
  }

  function toggleCaseRegister(r: CaseRegister) {
    setCaseRegisterVisible(prev => ({ ...prev, [r]: !prev[r] }));
  }

  function clearFilters() {
    setSearch('');
    setYearFrom(MIN_YEAR);
    setYearTo(MAX_YEAR);
    setTypeVisible({ legislation: true, incident: true, case: true, source: true });
    setCaseRegisterVisible({ protest: true, political_violence: true });
    setCategoryFilter(new Set());
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

  // Cross-page links from the three database pages land here as
  // /analytics?focus=<nodeId>[&edge=<otherNodeId>] — consume once, then
  // strip the params so a refresh/back-nav doesn't re-trigger the jump.
  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId) return;
    const edgeOtherId = searchParams.get('edge');
    if (edgeOtherId) {
      showEdgeInMap(focusId, edgeOtherId);
    } else {
      showNodeInMap(focusId);
    }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('focus');
      next.delete('edge');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      const caseLinks = edges
        .filter(e => e.case_id === sel.id || e.legislation_id === sel.id)
        .map((e): LinkedRecord | null => {
          const otherId = e.case_id === sel.id ? e.legislation_id : e.case_id;
          const other = nodeById.get(otherId);
          return other ? { label: other.label, note: e.provision ?? undefined } : null;
        })
        .filter((x): x is LinkedRecord => x !== null);
      if (sel.type === 'legislation') {
        const sourceLinks = legislationSourceEdges
          .filter(e => e.legislationId === sel.id)
          .map((e): LinkedRecord | null => {
            const s = nodeById.get(e.sourceId);
            return s ? { label: s.label, note: s.sub } : null;
          })
          .filter((x): x is LinkedRecord => x !== null);
        return [...sourceLinks, ...caseLinks];
      }
      return caseLinks;
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
      const incidentParent = incidentSourceEdges
        .filter(e => e.sourceId === sel.id)
        .map((e): LinkedRecord | null => {
          const inc = nodeById.get(e.incidentId);
          return inc ? { label: inc.label, note: 'Incident' } : null;
        })
        .filter((x): x is LinkedRecord => x !== null);
      const legislationParent = legislationSourceEdges
        .filter(e => e.sourceId === sel.id)
        .map((e): LinkedRecord | null => {
          const leg = nodeById.get(e.legislationId);
          return leg ? { label: leg.label, note: 'Legislation' } : null;
        })
        .filter((x): x is LinkedRecord => x !== null);
      return [...incidentParent, ...legislationParent];
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
      if (r.register !== legIdxRegister) return false;
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

  // --- Geographic map ---
  function toggleGeoRegister(r: CaseRegister) {
    setGeoRegisterVisible(prev => ({ ...prev, [r]: !prev[r] }));
  }

  const geoCases: GeoCase[] = useMemo(
    () => casesList
      .filter(c => {
        if (c.year < geoYearFrom || c.year > geoYearTo) return false;
        // Picking specific categories implies which register they belong to,
        // so it overrides the coarse register toggle rather than AND-ing
        // with it (avoids a confusing empty result if they disagree).
        if (geoCategoryFilter.size > 0) {
          const cat = caseCategory(c);
          return !!cat && geoCategoryFilter.has(cat);
        }
        return geoRegisterVisible[c.register];
      })
      .map(c => ({
        id: c.id, caseName: c.case_name, year: c.year, register: c.register,
        category: caseCategory(c), jurisdictionDisplay: c.jurisdiction_display, url: c.url,
      })),
    [geoYearFrom, geoYearTo, geoRegisterVisible, geoCategoryFilter]
  );

  const geoExcluded = useMemo(() => joinCasesToStates(geoCases).excluded, [geoCases]);

  // --- Timeline ---
  function toggleTlType(t: TimelineType) {
    setTlTypeVisible(prev => ({ ...prev, [t]: !prev[t] }));
  }
  function toggleTlRegister(r: CaseRegister) {
    setTlRegisterVisible(prev => ({ ...prev, [r]: !prev[r] }));
  }

  const tlLegislation = useMemo(
    () => (!tlTypeVisible.legislation ? [] : legislationCategories.flatMap(cat => cat.entries)
      .filter(e => e.year >= tlYearFrom && e.year <= tlYearTo &&
        (!debouncedTlSearch || e.short_title.toLowerCase().includes(debouncedTlSearch)))
      .map(e => ({ id: e.id, label: e.short_title, year: e.year }))),
    [tlTypeVisible.legislation, tlYearFrom, tlYearTo, debouncedTlSearch]
  );

  const tlIncidents = useMemo(
    () => (!tlTypeVisible.incident ? [] : incidentsList
      .filter(i => i.year >= tlYearFrom && i.year <= tlYearTo &&
        (!debouncedTlSearch || i.short_title.toLowerCase().includes(debouncedTlSearch)))
      .map(i => ({ id: i.id, label: i.short_title, year: i.year }))),
    [tlTypeVisible.incident, tlYearFrom, tlYearTo, debouncedTlSearch]
  );

  const tlCases = useMemo(
    () => (!tlTypeVisible.case ? [] : casesList
      .filter(c => {
        if (c.year < tlYearFrom || c.year > tlYearTo) return false;
        if (debouncedTlSearch && !c.case_name.toLowerCase().includes(debouncedTlSearch)) return false;
        // Same override rule as the Geo Map: picking categories implies
        // which register they belong to, so it replaces the register toggle.
        if (tlCategoryFilter.size > 0) {
          const cat = caseCategory(c);
          return !!cat && tlCategoryFilter.has(cat);
        }
        return tlRegisterVisible[c.register];
      })
      .map(c => ({ id: c.id, label: c.case_name, year: c.year, register: c.register, category: caseCategory(c), url: c.url }))),
    [tlTypeVisible.case, tlRegisterVisible, tlCategoryFilter, tlYearFrom, tlYearTo, debouncedTlSearch]
  );

  const tlEdges = useMemo(() => edges.map(e => ({ caseId: e.case_id, legislationId: e.legislation_id })), []);

  const tlHasFilter = tlSearch !== '' || tlYearFrom !== MIN_YEAR || tlYearTo !== MAX_YEAR ||
    Object.values(tlTypeVisible).some(v => !v) || Object.values(tlRegisterVisible).some(v => !v) ||
    tlCategoryFilter.size > 0;

  function clearTlFilters() {
    setTlSearch('');
    setTlYearFrom(MIN_YEAR);
    setTlYearTo(MAX_YEAR);
    setTlTypeVisible({ legislation: true, incident: true, case: true });
    setTlRegisterVisible({ protest: true, political_violence: true });
    setTlCategoryFilter(new Set());
  }

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
            <button className={`inc-view-tab${activeTab === 'geoMap' ? ' inc-view-tab-active' : ''}`} onClick={() => setActiveTab('geoMap')}>
              Geographic Map
            </button>
            <button className={`inc-view-tab${activeTab === 'timeline' ? ' inc-view-tab-active' : ''}`} onClick={() => setActiveTab('timeline')}>
              Timeline
            </button>
          </div>

          {activeTab === 'network' && (
            <div style={{ marginTop: '1.5rem' }}>
              <p className="db-note" style={{ textAlign: 'left', marginTop: 0, marginBottom: '1.25rem' }}>
                Every legislation, incident, case and cited source is plotted as a node, each database its own
                colour. Case-to-legislation edges are drawn from the case registers' own legislation mapping, so
                only cases and Acts that connect to a live Legislation Tracker entry are linked — the rest remain
                unlinked nodes. Source nodes come from two places: each incident's own source list (in the Incidents
                Tracker), and each Act or instrument's own official legislative text (its Legislation Tracker link).
                Click a source node to see its evidentiary type — News media, Government or official, Legal or NGO
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
                      <span className="leg-filter-label">Case register</span>
                      {(Object.keys(CASE_REGISTER_META) as CaseRegister[]).map(r => (
                        <button
                          key={r}
                          className={`db-pill${caseRegisterVisible[r] ? ' db-pill-active' : ''}`}
                          onClick={() => toggleCaseRegister(r)}
                          disabled={!typeVisible.case}
                          style={caseRegisterVisible[r] && typeVisible.case ? { background: CASE_REGISTER_META[r].color, borderColor: CASE_REGISTER_META[r].color } : undefined}
                        >
                          {CASE_REGISTER_META[r].label}
                        </button>
                      ))}
                    </div>
                    <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                      <span className="leg-filter-label">Colour by</span>
                      <button className={`leg-pill${colourMode === 'database' ? ' leg-pill-active' : ''}`} onClick={() => setColourMode('database')}>Database</button>
                      <button className={`leg-pill${colourMode === 'caseType' ? ' leg-pill-active' : ''}`} onClick={() => setColourMode('caseType')}>Case type</button>
                      <button className={`leg-pill${colourMode === 'category' ? ' leg-pill-active' : ''}`} onClick={() => setColourMode('category')}>Category</button>
                      <span className="leg-filter-label" style={{ marginLeft: '1.5rem' }}>Size by</span>
                      {(Object.keys(SIZE_MODE_META) as SizeMode[]).map(sm => (
                        <button key={sm} className={`leg-pill${sizeMode === sm ? ' leg-pill-active' : ''}`} onClick={() => setSizeMode(sm)}>
                          {SIZE_MODE_META[sm]}
                        </button>
                      ))}
                    </div>
                    <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                      <span className="leg-filter-label">Category</span>
                      <CategoryMultiSelect options={ALL_CATEGORY_OPTIONS} selected={categoryFilter} onChange={setCategoryFilter} />
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
                        {colourMode === 'database' && (
                          <div className="cases-legend-item">
                            <span className="cases-legend-dot" style={{ background: TYPE_META.case.color }} />
                            {TYPE_META.case.label}
                          </div>
                        )}
                        {colourMode === 'caseType' && (
                          (Object.keys(CASE_REGISTER_META) as CaseRegister[]).map(r => (
                            <div key={r} className="cases-legend-item">
                              <span className="cases-legend-dot" style={{ background: CASE_REGISTER_META[r].color }} />
                              {CASE_REGISTER_META[r].label}
                            </div>
                          ))
                        )}
                        {colourMode === 'category' && (
                          presentCategories.length === 0 ? (
                            <span className="cases-legend-item">No categorised cases visible</span>
                          ) : (
                            presentCategories.map(cat => (
                              <div key={cat} className="cases-legend-item">
                                <span className="cases-legend-dot" style={{ background: CATEGORY_COLOUR.get(cat) }} />
                                {cat}
                              </div>
                            ))
                          )
                        )}
                        <div className="cases-legend-item">
                          <span className="cases-legend-dot" style={{ background: TYPE_META.source.color }} />
                          {TYPE_META.source.label}
                        </div>
                      </div>
                      <div className="cases-chart-legend" style={{ marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                        <span className="cases-legend-label">Edges</span>
                        {(Object.keys(CASE_REGISTER_META) as CaseRegister[]).map(r => (
                          <div key={r} className="cases-legend-item">
                            <span className="cases-legend-line" style={{ background: CASE_REGISTER_META[r].color }} />
                            {CASE_REGISTER_META[r].label} → legislation
                          </div>
                        ))}
                        <div className="cases-legend-item">
                          <span className="cases-legend-line" style={{ background: SOURCE_EDGE_COLOUR }} />
                          Source → incident / legislation
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

          {activeTab === 'geoMap' && (
            <div style={{ marginTop: '1.5rem' }}>
              <p className="db-note" style={{ textAlign: 'left', marginTop: 0, marginBottom: '1.25rem' }}>
                Each state or territory shows two proportional markers, sized by how many cases in the current
                filter are attributed to it — one for protest cases, one for political violence cases. A case with
                jurisdiction spanning multiple states counts toward each one. Cases with no state-level jurisdiction
                (Commonwealth-only reach, or not yet identified) can't be placed on the map and are excluded.
              </p>

              <div className="analytics-filter-bar">
                <div className="leg-filter-group">
                  <span className="leg-filter-label">Register</span>
                  {(['protest', 'political_violence'] as CaseRegister[]).map(r => (
                    <button
                      key={r}
                      className={`db-pill${geoRegisterVisible[r] ? ' db-pill-active' : ''}`}
                      onClick={() => toggleGeoRegister(r)}
                      style={geoRegisterVisible[r] ? { background: CASE_REGISTER_META[r].color, borderColor: CASE_REGISTER_META[r].color } : undefined}
                    >
                      {CASE_REGISTER_META[r].label}
                    </button>
                  ))}
                </div>
                <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                  <span className="leg-filter-label">Year range</span>
                  <div className="inc-year-range">
                    <span>{geoYearFrom}</span>
                    <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={geoYearFrom}
                      onChange={e => setGeoYearFrom(Math.min(Number(e.target.value), geoYearTo))} />
                    <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={geoYearTo}
                      onChange={e => setGeoYearTo(Math.max(Number(e.target.value), geoYearFrom))} />
                    <span>{geoYearTo}</span>
                  </div>
                </div>
                <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                  <span className="leg-filter-label">Breakdown by category</span>
                  <CategoryMultiSelect options={ALL_CATEGORY_OPTIONS} selected={geoCategoryFilter} onChange={setGeoCategoryFilter} />
                </div>
              </div>

              <p className="events-detail-note" style={{ marginBottom: '0.75rem' }}>
                Scroll to zoom · drag to pan · click a state or one of its markers to see its cases.
                {geoExcluded > 0 && ` ${geoExcluded.toLocaleString()} case${geoExcluded === 1 ? '' : 's'} excluded — jurisdiction not state-level.`}
                {geoCategoryFilter.size > 0 && ' Ticking categories replaces the register split above with one marker per selected category, so you can compare where each is concentrated.'}
              </p>

              <div className="analytics-layout">
                <div className="analytics-graph-wrapper">
                  <GeoMap
                    cases={geoCases}
                    height={GRAPH_HEIGHT}
                    registerColours={{ protest: CASE_REGISTER_META.protest.color, political_violence: CASE_REGISTER_META.political_violence.color }}
                    selectedCategories={geoCategoryFilter}
                    categoryColours={CATEGORY_COLOUR}
                    onSelectState={setGeoSelected}
                  />
                  <div className="cases-chart-legend" style={{ marginTop: '0.75rem' }}>
                    {geoCategoryFilter.size === 0 ? (
                      (['protest', 'political_violence'] as CaseRegister[]).map(r => (
                        <div key={r} className="cases-legend-item">
                          <span className="cases-legend-dot" style={{ background: CASE_REGISTER_META[r].color }} />
                          {CASE_REGISTER_META[r].label}
                        </div>
                      ))
                    ) : (
                      [...geoCategoryFilter].sort().map(cat => (
                        <div key={cat} className="cases-legend-item">
                          <span className="cases-legend-dot" style={{ background: CATEGORY_COLOUR.get(cat) }} />
                          {cat}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="analytics-detail-panel">
                  {geoSelected ? (
                    <>
                      <h3 className="analytics-detail-title">{geoSelected.stateName}</h3>
                      <p className="analytics-detail-sub">{CASE_REGISTER_META.protest.label}: {geoSelected.counts.protest}</p>
                      <p className="analytics-detail-sub">{CASE_REGISTER_META.political_violence.label}: {geoSelected.counts.political_violence}</p>
                      {geoCategoryFilter.size > 0 ? (
                        [...geoCategoryFilter].sort().map(cat => {
                          const catCases = geoSelected.cases.filter(c => c.category === cat);
                          if (catCases.length === 0) return null;
                          return (
                            <div key={cat}>
                              <div className="events-detail-h4" style={{ marginTop: '1.25rem', color: CATEGORY_COLOUR.get(cat) }}>
                                {cat} ({catCases.length})
                              </div>
                              <ul className="events-plain-list" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                                {catCases.map(c => (
                                  <li key={c.id}>
                                    {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c.caseName}</a> : c.caseName}
                                    <span className="events-detail-note"> — {c.year}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })
                      ) : (
                        (['protest', 'political_violence'] as CaseRegister[]).map(register => {
                          const regionCases = geoSelected.cases.filter(c => c.register === register);
                          if (regionCases.length === 0) return null;
                          return (
                            <div key={register}>
                              <div className="events-detail-h4" style={{ marginTop: '1.25rem', color: CASE_REGISTER_META[register].color }}>
                                {CASE_REGISTER_META[register].label} ({regionCases.length})
                              </div>
                              <ul className="events-plain-list" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                                {regionCases.map(c => (
                                  <li key={c.id}>
                                    {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c.caseName}</a> : c.caseName}
                                    <span className="events-detail-note"> — {c.year}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      Click a state to see its cases.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div style={{ marginTop: '1.5rem' }}>
              <p className="db-note" style={{ textAlign: 'left', marginTop: 0, marginBottom: '1.25rem' }}>
                Legislation, incidents and cases plotted against a shared year axis. Click a piece of legislation to
                see which cases cite it and when — including whether use of it grew or fell away over time. Click a
                case to see the legislation it draws on.
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
                    placeholder="Search legislation, incident or case labels…"
                    value={tlSearch}
                    onChange={e => setTlSearch(e.target.value)}
                  />
                  {tlSearch && (
                    <button className="db-search-clear" onClick={() => setTlSearch('')} aria-label="Clear search">×</button>
                  )}
                </div>
                <span className="db-count">{(tlLegislation.length + tlIncidents.length + tlCases.length).toLocaleString()} items shown</span>
              </div>

              <div className="analytics-filter-bar">
                <div className="leg-filter-group">
                  <span className="leg-filter-label">Databases</span>
                  {(['legislation', 'incident', 'case'] as TimelineType[]).map(t => (
                    <button
                      key={t}
                      className={`db-pill${tlTypeVisible[t] ? ' db-pill-active' : ''}`}
                      onClick={() => toggleTlType(t)}
                      style={tlTypeVisible[t] ? { background: TYPE_META[t].color, borderColor: TYPE_META[t].color } : undefined}
                    >
                      {TYPE_META[t].label}
                    </button>
                  ))}
                </div>
                <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                  <span className="leg-filter-label">Case register</span>
                  {(['protest', 'political_violence'] as CaseRegister[]).map(r => (
                    <button key={r} className={`leg-pill${tlRegisterVisible[r] ? ' leg-pill-active' : ''}`} onClick={() => toggleTlRegister(r)}>
                      {CASE_REGISTER_META[r].label}
                    </button>
                  ))}
                  <button className="leg-pill" style={{ marginLeft: '0.75rem' }} onClick={() => tlCmdRef.current?.resetZoom()}>Reset zoom</button>
                </div>
                <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                  <span className="leg-filter-label">Category</span>
                  <CategoryMultiSelect options={ALL_CATEGORY_OPTIONS} selected={tlCategoryFilter} onChange={setTlCategoryFilter} />
                </div>
                <div className="leg-filter-group" style={{ marginTop: '0.5rem' }}>
                  <span className="leg-filter-label">Year range</span>
                  <div className="inc-year-range">
                    <span>{tlYearFrom}</span>
                    <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={tlYearFrom}
                      onChange={e => setTlYearFrom(Math.min(Number(e.target.value), tlYearTo))} />
                    <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={tlYearTo}
                      onChange={e => setTlYearTo(Math.max(Number(e.target.value), tlYearFrom))} />
                    <span>{tlYearTo}</span>
                  </div>
                  {tlHasFilter && (
                    <button className="leg-pill" onClick={clearTlFilters} style={{ marginLeft: 'auto' }}>Clear ×</button>
                  )}
                </div>
              </div>

              <p className="events-detail-note" style={{ marginBottom: '0.75rem' }}>
                Scroll to zoom into a period · drag to pan the year axis · click a legislation or case dot to see its
                connections (arcs are only drawn for the selected item, to keep this readable).
              </p>

              <div className="analytics-layout">
                <div className="analytics-graph-wrapper">
                  <Timeline
                    legislation={tlLegislation}
                    incidents={tlIncidents}
                    cases={tlCases}
                    edges={tlEdges}
                    minYear={tlYearFrom}
                    maxYear={tlYearTo}
                    height={GRAPH_HEIGHT}
                    typeColours={{ legislation: TYPE_META.legislation.color, incident: TYPE_META.incident.color, case: TYPE_META.case.color }}
                    registerColours={{ protest: CASE_REGISTER_META.protest.color, political_violence: CASE_REGISTER_META.political_violence.color }}
                    categoryColours={CATEGORY_COLOUR}
                    cmdRef={tlCmdRef}
                    onSelect={setTlSelected}
                  />
                  <div className="cases-chart-legend" style={{ marginTop: '0.75rem' }}>
                    {(['legislation', 'incident'] as TimelineType[]).map(t => (
                      <div key={t} className="cases-legend-item">
                        <span className="cases-legend-dot" style={{ background: TYPE_META[t].color }} />
                        {TYPE_META[t].label}
                      </div>
                    ))}
                    {tlCategoryFilter.size === 0 ? (
                      (['protest', 'political_violence'] as CaseRegister[]).map(r => (
                        <div key={r} className="cases-legend-item">
                          <span className="cases-legend-dot" style={{ background: CASE_REGISTER_META[r].color }} />
                          {CASE_REGISTER_META[r].label}
                        </div>
                      ))
                    ) : (
                      [...tlCategoryFilter].sort().map(cat => (
                        <div key={cat} className="cases-legend-item">
                          <span className="cases-legend-dot" style={{ background: CATEGORY_COLOUR.get(cat) }} />
                          {cat}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="analytics-detail-panel">
                  {tlSelected ? (
                    <>
                      <span
                        className="db-pill db-pill-active"
                        style={{
                          background: tlSelected.type === 'case' ? 'var(--color-primary)' : TYPE_META[tlSelected.type].color,
                          borderColor: tlSelected.type === 'case' ? 'var(--color-primary)' : TYPE_META[tlSelected.type].color,
                          cursor: 'default',
                        }}
                      >
                        {tlSelected.sub}
                      </span>
                      <h3 className="analytics-detail-title">{tlSelected.label}</h3>
                      <p className="analytics-detail-sub">Year: {tlSelected.year}</p>
                      {tlSelected.yearCounts && tlSelected.yearCounts.length > 0 && (
                        <>
                          <div className="events-detail-h4" style={{ marginTop: '1rem' }}>Cases citing this, by year</div>
                          <TimelineSparkline data={tlSelected.yearCounts} colour={TYPE_META.legislation.color} />
                        </>
                      )}
                      {tlSelected.linked.length === 0 ? (
                        <p className="events-detail-note" style={{ marginTop: '1.25rem' }}>
                          No linked records for this item.
                        </p>
                      ) : (
                        <>
                          <div className="events-detail-h4" style={{ marginTop: '1.25rem' }}>
                            Linked records ({tlSelected.linked.length})
                          </div>
                          <ul className="events-plain-list">
                            {tlSelected.linked.slice(0, 8).map(l => (
                              <li key={l.id}>
                                {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a> : l.label}
                                <span className="events-detail-note"> — {l.year}</span>
                              </li>
                            ))}
                          </ul>
                          {tlSelected.linked.length > 8 && (
                            <p className="events-detail-note">and {tlSelected.linked.length - 8} more.</p>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      Click a legislation, incident, or case dot to see its details.
                    </p>
                  )}
                </div>
              </div>
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
                {(['protest', 'political_violence'] as CaseRegister[]).map(r => (
                  <button
                    key={r}
                    className={`leg-pill${legIdxRegister === r ? ' leg-pill-active' : ''}`}
                    onClick={() => setLegIdxRegister(r)}
                  >
                    {CASE_REGISTER_META[r].label}
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
