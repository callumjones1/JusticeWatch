import { useState, useMemo, useRef, useEffect } from 'react';
import data from '../data/cases.json';

type CaseRegister = 'protest' | 'political_violence';

type Case = {
  id: string;
  register: CaseRegister;
  case_name: string;
  citation: string;
  year: number;
  court: string;
  jurisdiction: string | null;
  jurisdiction_multi: boolean;
  jurisdiction_display: string | null;
  forum_level: string;
  case_type: string | null;
  event_types: string[];
  ideology_cause: string[];
  provisions_engaged: string[];
  acts_engaged: string[];
  tracker_categories: string[];
  summary: string | null;
  main_issue?: string;
  outcome: string | null;
  result: string | null;
  register_category: string | null;
  implied_freedom_raised: boolean | null;
  sanction_type?: string;
  url: string | null;
  tags: string[];
};

const cases = data.cases as Case[];

const SPLIT_TABS: { key: CaseRegister; label: string }[] = [
  { key: 'protest', label: 'Protest' },
  { key: 'political_violence', label: 'Political Violence' },
];

const MIN_YEAR = Math.min(...cases.map(c => c.year));
const MAX_YEAR = Math.max(...cases.map(c => c.year));

const FORUM_LEVELS = ['All', 'State', 'Territory', 'Federal', 'HCA', 'Tribunal'];
const FORUM_Y: Record<string, number> = { State: 0.82, Territory: 0.82, Tribunal: 0.68, Federal: 0.45, HCA: 0.12 };

// Protest tab: coloured by result for protesters
const RESULT_COLOURS: Record<string, string> = {
  Favourable: '#16a34a',
  Unfavourable: '#dc2626',
  Mixed: '#d97706',
  Pending: '#64748b',
  Unknown: '#9ca3af',
};
const RESULT_ORDER = ['Favourable', 'Mixed', 'Unfavourable', 'Pending', 'Unknown'];

// Political violence tab: coloured by proceeding-stage case type, since there's no
// outcome/result field — most of this register is preventive schemes that never
// produce a conviction.
const CASE_TYPE_COLOURS: Record<string, string> = {
  preventive_or_supervision_order: '#7c3aed',
  appeal: '#1d3a5c',
  sentencing: '#dc2626',
  pretrial_or_evidentiary_ruling: '#0d9488',
  civil_or_administrative: '#d97706',
  constitutional: '#4ade80',
  trial_or_verdict: '#f97316',
  other: '#9ca3af',
};

function caseTypeLabel(t: string | null): string {
  if (!t) return 'Other';
  return CASE_TYPE_COLOURS[t] ? t.replace(/_/g, ' ') : t;
}

type TabConfig = {
  categoryOf: (c: Case) => string;
  colours: Record<string, string>;
  categoryLabel: (key: string) => string;
  categoryOrder: string[];
  axisLabel: string;
};

const TAB_CONFIG: Record<CaseRegister, TabConfig> = {
  protest: {
    categoryOf: c => c.result ?? 'Unknown',
    colours: RESULT_COLOURS,
    categoryLabel: k => k,
    categoryOrder: RESULT_ORDER,
    axisLabel: 'Result for protesters',
  },
  political_violence: {
    categoryOf: c => c.case_type ?? 'other',
    colours: CASE_TYPE_COLOURS,
    categoryLabel: caseTypeLabel,
    categoryOrder: Object.keys(CASE_TYPE_COLOURS),
    axisLabel: 'Proceeding type',
  },
};

// Scatter chart constants
const CHART_W = 800;
const CHART_H = 300;
const PAD = { top: 24, right: 24, bottom: 44, left: 90 };

export default function CaseStudies() {
  const [split, setSplit] = useState<CaseRegister>('protest');
  const [view, setView] = useState<'table' | 'chart' | 'breakdown'>('table');
  const [yearFrom, setYearFrom] = useState(MIN_YEAR);
  const [yearTo, setYearTo] = useState(MAX_YEAR);
  const [filterJur, setFilterJur] = useState('All');
  const [filterForum, setFilterForum] = useState('All');
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<'year' | 'case_name' | 'court' | 'jurisdiction' | 'forum_level'>('year');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; c: Case } | null>(null);
  const [chartDetail, setChartDetail] = useState<Case | null>(null);
  const [bdTooltip, setBdTooltip] = useState<{ x: number; y: number; year: number; segments: { key: string; count: number }[] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const config = TAB_CONFIG[split];
  const splitCases = useMemo(() => cases.filter(c => c.register === split), [split]);

  const ALL_JURISDICTIONS = useMemo(
    () => ['All', ...Array.from(new Set(splitCases.map(c => c.jurisdiction_display).filter((j): j is string => !!j))).sort()],
    [splitCases]
  );
  const ALL_TAGS = useMemo(
    () => Array.from(new Set(splitCases.flatMap(c => c.tags))).sort(),
    [splitCases]
  );

  const [tagsExpanded, setTagsExpanded] = useState(false);
  const TAGS_COLLAPSED_COUNT = 14;

  function selectSplit(next: CaseRegister) {
    setSplit(next);
    setFilterJur('All');
    setFilterForum('All');
    setFilterTags(new Set());
    setOpenRow(null);
    setChartDetail(null);
    setTagsExpanded(false);
  }

  function toggleTag(tag: string) {
    setFilterTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function clearFilters() {
    setYearFrom(MIN_YEAR);
    setYearTo(MAX_YEAR);
    setFilterJur('All');
    setFilterForum('All');
    setFilterTags(new Set());
  }

  const hasFilter = yearFrom !== MIN_YEAR || yearTo !== MAX_YEAR ||
    filterJur !== 'All' || filterForum !== 'All' || filterTags.size > 0;

  const filtered = useMemo(() => splitCases.filter(c => {
    if (c.year < yearFrom || c.year > yearTo) return false;
    if (filterJur !== 'All' && c.jurisdiction_display !== filterJur) return false;
    if (filterForum !== 'All' && c.forum_level !== filterForum) return false;
    if (filterTags.size > 0 && !c.tags.some(t => filterTags.has(t))) return false;
    return true;
  }), [splitCases, yearFrom, yearTo, filterJur, filterForum, filterTags]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a[sortCol] ?? '') as string | number;
      const bv = (b[sortCol] ?? '') as string | number;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  function handleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  // Deterministic jitter for scatter chart dots
  function djitter(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) { h = ((h << 5) - h) + id.charCodeAt(i); h |= 0; }
    return (h % 100) / 100 * 10 - 5;
  }

  const categoryKeys = useMemo(() => {
    const present = new Set(splitCases.map(config.categoryOf));
    const ordered = config.categoryOrder.filter(k => present.has(k));
    const extra = [...present].filter(k => !config.categoryOrder.includes(k));
    return [...ordered, ...extra];
  }, [splitCases, config]);

  // Breakdown data: per-year stacked by category
  const trendData = useMemo(() => {
    const years = [...new Set(splitCases.map(c => c.year))].sort();
    return years.map(year => {
      const yearCases = splitCases.filter(c => c.year === year);
      const segments = categoryKeys.map(key => ({
        key,
        active: yearCases.filter(c => config.categoryOf(c) === key && filtered.includes(c)).length,
        dimmed: yearCases.filter(c => config.categoryOf(c) === key && !filtered.includes(c)).length,
      }));
      return { year, segments, total: yearCases.length, activeTotal: filtered.filter(c => c.year === year).length };
    });
  }, [splitCases, filtered, categoryKeys, config]);

  // Live summary stats: count of filtered cases per category
  const liveCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of categoryKeys) counts[key] = 0;
    for (const c of filtered) {
      const k = config.categoryOf(c);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [filtered, categoryKeys, config]);

  const pieSegments = useMemo(() => {
    const total = filtered.length;
    if (total === 0) return [];
    const slices = categoryKeys
      .map(k => ({ key: k, label: config.categoryLabel(k), count: liveCounts[k] ?? 0, color: config.colours[k] ?? '#9ca3af' }))
      .filter(s => s.count > 0);
    let angle = -Math.PI / 2;
    return slices.map(s => {
      const sweep = (s.count / total) * 2 * Math.PI;
      const start = angle;
      angle += sweep;
      return { ...s, start, end: angle, sweep };
    });
  }, [liveCounts, categoryKeys, config, filtered.length]);

  function pieArcPath(cx: number, cy: number, r: number, start: number, end: number): string {
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  const xScale = (year: number) => {
    const range = MAX_YEAR - MIN_YEAR || 1;
    return PAD.left + ((year - MIN_YEAR) / range) * (CHART_W - PAD.left - PAD.right);
  };
  const yScale = (forum: string) => {
    const t = FORUM_Y[forum] ?? 0.5;
    return PAD.top + t * (CHART_H - PAD.top - PAD.bottom);
  };

  const xTicks = Array.from(new Set(splitCases.map(c => c.year))).sort();
  const displayXTicks = xTicks.filter(y => (y - MIN_YEAR) % 3 === 0 || y === MIN_YEAR || y === MAX_YEAR);
  const usedForumLevels = useMemo(
    () => FORUM_LEVELS.slice(1).filter(f => splitCases.some(c => c.forum_level === f)),
    [splitCases]
  );

  useEffect(() => {
    function handler() { setTooltip(null); }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Case Tracker</h1>
          <p className="page-subtitle">{data.metadata.description}</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <p className="db-note" style={{ textAlign: 'left', marginBottom: '1.25rem', marginTop: 0 }}>
            This tracker is a research and reference tool and does not constitute legal advice. Charges are allegations until proven; acquittals, withdrawals and appeals are recorded alongside convictions. Each record shows its sources where available and its last-verified date.
          </p>

          <div className="inc-view-toggle">
            {SPLIT_TABS.map(tab => (
              <button
                key={tab.key}
                className={`inc-view-tab${split === tab.key ? ' inc-view-tab-active' : ''}`}
                onClick={() => selectSplit(tab.key)}
              >
                {tab.label} ({cases.filter(c => c.register === tab.key).length})
              </button>
            ))}
          </div>

          {/* Summary stats + pie chart */}
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'stretch', flexWrap: 'wrap', marginBottom: '1.5rem', marginTop: '1.5rem' }}>
            <div className="db-stats-bar" style={{ flex: '1', minWidth: '280px', margin: 0 }}>
              <div className="db-stat-tile">
                <span className="db-stat-num">{filtered.length}</span>
                <span className="db-stat-label">Total Cases</span>
              </div>
              {categoryKeys.slice(0, 3).map(key => (
                <div className="db-stat-tile" key={key}>
                  <span className="db-stat-num" style={{ color: config.colours[key] ?? '#9ca3af' }}>{liveCounts[key] ?? 0}</span>
                  <span className="db-stat-label">{config.categoryLabel(key)}</span>
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '1.5rem',
              background: 'var(--color-background-warm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '1.25rem 1.75rem',
              flexShrink: 0,
            }}>
              <svg width="160" height="160" viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
                {filtered.length === 0
                  ? <circle cx="80" cy="80" r="72" fill="var(--color-border)" />
                  : pieSegments.map((s, i) => (
                    <path
                      key={i}
                      d={pieArcPath(80, 80, 72, s.start, s.end)}
                      fill={s.color}
                      fillOpacity={0.88}
                      stroke="white"
                      strokeWidth="2"
                    >
                      <title>{s.label}: {s.count}</title>
                    </path>
                  ))
                }
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
                {pieSegments.map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ color: 'var(--color-text-muted)' }}>{s.label}</span>
                    <strong style={{ color: s.color, marginLeft: 'auto', paddingLeft: '0.75rem' }}>{s.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* View tabs */}
          <div className="cases-view-tabs">
            <button className={`cases-tab${view === 'table' ? ' cases-tab-active' : ''}`} onClick={() => setView('table')}>
              Table
            </button>
            <button className={`cases-tab${view === 'chart' ? ' cases-tab-active' : ''}`} onClick={() => setView('chart')}>
              Scatter
            </button>
            <button className={`cases-tab${view === 'breakdown' ? ' cases-tab-active' : ''}`} onClick={() => setView('breakdown')}>
              Breakdown
            </button>
          </div>

          {/* Filters */}
          <div className="cases-filters">
            <div className="cases-filter-group">
              <span className="cases-filter-label">Year range</span>
              <div className="cases-year-range">
                <span>{yearFrom}</span>
                <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={yearFrom}
                  onChange={e => setYearFrom(Math.min(Number(e.target.value), yearTo))} />
                <input type="range" min={MIN_YEAR} max={MAX_YEAR} value={yearTo}
                  onChange={e => setYearTo(Math.max(Number(e.target.value), yearFrom))} />
                <span>{yearTo}</span>
              </div>
            </div>
            <div className="cases-filter-group">
              <span className="cases-filter-label">Jurisdiction</span>
              <select className="cases-filter-select" value={filterJur} onChange={e => setFilterJur(e.target.value)}>
                {ALL_JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div className="cases-filter-group">
              <span className="cases-filter-label">Forum level</span>
              <select className="cases-filter-select" value={filterForum} onChange={e => setFilterForum(e.target.value)}>
                <option>All</option>
                {usedForumLevels.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="cases-filter-group" style={{ flexBasis: '100%' }}>
              <span className="cases-filter-label">{split === 'protest' ? 'Cause / register category' : 'Ideology / case type'}</span>
              <div className="cases-tags-pills">
                {(tagsExpanded ? ALL_TAGS : ALL_TAGS.slice(0, TAGS_COLLAPSED_COUNT)).map(t => (
                  <button
                    key={t}
                    className={`cases-tag-pill${filterTags.has(t) ? ' cases-tag-pill-active' : ''}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
                {ALL_TAGS.length > TAGS_COLLAPSED_COUNT && (
                  <button className="cases-tag-pill" onClick={() => setTagsExpanded(v => !v)}>
                    {tagsExpanded ? 'Show less' : `+${ALL_TAGS.length - TAGS_COLLAPSED_COUNT} more`}
                  </button>
                )}
                {hasFilter && (
                  <button className="cases-tag-pill" onClick={clearFilters} style={{ marginLeft: '0.5rem' }}>
                    Clear all ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table view */}
          {view === 'table' && (
            <div className="cases-table-wrapper">
              <table className="cases-table">
                <thead>
                  <tr>
                    {(['year', 'case_name', 'court', 'jurisdiction', 'forum_level'] as const).map(col => {
                      const labels: Record<string, string> = {
                        year: 'Year', case_name: 'Case Name', court: 'Court',
                        jurisdiction: 'Jurisdiction', forum_level: 'Forum',
                      };
                      return (
                        <th
                          key={col}
                          className="cases-th"
                          onClick={() => handleSort(col)}
                          style={{ cursor: 'pointer' }}
                        >
                          {labels[col]}
                          <span className={`sort-indicator${sortCol === col ? ' sort-indicator-active' : ''}`}>
                            {sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                          </span>
                        </th>
                      );
                    })}
                    <th className="cases-th">{config.axisLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        No cases match the current filters.
                      </td>
                    </tr>
                  )}
                  {sorted.map(c => {
                    const isOpen = openRow === c.id;
                    const catKey = config.categoryOf(c);
                    const catColour = config.colours[catKey] ?? '#9ca3af';
                    return [
                      <tr
                        key={c.id}
                        className={`cases-row${!filtered.includes(c) ? ' cases-row-dimmed' : ''}`}
                        onClick={() => setOpenRow(isOpen ? null : c.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="cases-td cases-td-year">{c.year}</td>
                        <td className="cases-td">
                          {c.url ? (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cases-name-link"
                              onClick={e => e.stopPropagation()}
                            >
                              {c.case_name}
                            </a>
                          ) : c.case_name}
                          <div className="cases-citation">{c.citation}</div>
                        </td>
                        <td className="cases-td" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{c.court}</td>
                        <td className="cases-td" style={{ fontSize: '0.85rem' }}>{c.jurisdiction_display ?? '—'}</td>
                        <td className="cases-td" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{c.forum_level}</td>
                        <td className="cases-td">
                          <span
                            className="cases-outcome-badge"
                            style={{
                              backgroundColor: catColour + '22',
                              color: catColour,
                              border: `1px solid ${catColour}44`,
                            }}
                          >
                            {config.categoryLabel(catKey)}
                          </span>
                        </td>
                      </tr>,
                      isOpen && (
                        <tr key={`${c.id}-detail`} className="cases-detail-row">
                          <td colSpan={6}>
                            <div className="cases-detail-panel">
                              {c.summary && (<><h4>Summary</h4><p>{c.summary}</p></>)}
                              {c.main_issue && (<><h4>Main issue</h4><p>{c.main_issue}</p></>)}
                              {c.outcome && (<><h4>Outcome</h4><p>{c.outcome}</p></>)}
                              {c.acts_engaged.length > 0 && (
                                <>
                                  <h4>Legislation engaged</h4>
                                  <div className="cases-detail-tags">
                                    {c.acts_engaged.map(a => <span key={a} className="cases-detail-tag">{a}</span>)}
                                  </div>
                                </>
                              )}
                              {c.tags.length > 0 && (
                                <>
                                  <h4>Tags</h4>
                                  <div className="cases-detail-tags">
                                    {c.tags.map(t => (
                                      <span key={t} className="cases-detail-tag">{t}</span>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Chart view */}
          {view === 'chart' && (
            <div className="cases-chart-container">
              <p className="cases-chart-hint">
                X-axis: year · Y-axis: forum level · Colour: {config.axisLabel.toLowerCase()} · Click a dot to inspect · Filtered-out cases are dimmed
              </p>
              <div style={{ position: 'relative' }}>
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                  {usedForumLevels.map(f => (
                    <text key={f} x={PAD.left - 8} y={yScale(f) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                      {f}
                    </text>
                  ))}
                  {usedForumLevels.map(f => (
                    <line
                      key={`grid-${f}`}
                      x1={PAD.left}
                      y1={yScale(f)}
                      x2={CHART_W - PAD.right}
                      y2={yScale(f)}
                      stroke="#e8e4de"
                      strokeWidth="1"
                    />
                  ))}
                  {displayXTicks.map(y => (
                    <g key={y}>
                      <line x1={xScale(y)} y1={CHART_H - PAD.bottom + 4} x2={xScale(y)} y2={CHART_H - PAD.bottom} stroke="#9ca3af" strokeWidth="1" />
                      <text x={xScale(y)} y={CHART_H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill="#6b7280">{y}</text>
                    </g>
                  ))}
                  <line x1={PAD.left} y1={CHART_H - PAD.bottom} x2={CHART_W - PAD.right} y2={CHART_H - PAD.bottom} stroke="#d1d5db" strokeWidth="1" />

                  {splitCases.map(c => {
                    const isFiltered = filtered.includes(c);
                    const cx = xScale(c.year) + djitter(c.id);
                    const cy = yScale(c.forum_level);
                    const colour = config.colours[config.categoryOf(c)] ?? '#9ca3af';
                    return (
                      <circle
                        key={c.id}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={colour}
                        fillOpacity={isFiltered ? 0.85 : 0.1}
                        stroke={colour}
                        strokeWidth={isFiltered ? 1.5 : 0.5}
                        strokeOpacity={isFiltered ? 1 : 0.3}
                        style={{ cursor: isFiltered ? 'pointer' : 'default', transition: 'fill-opacity 0.3s' }}
                        onClick={e => {
                          e.stopPropagation();
                          if (!isFiltered) return;
                          const rect = svgRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          const scaleX = rect.width / CHART_W;
                          const scaleY = rect.height / CHART_H;
                          setTooltip({ x: cx * scaleX + rect.left, y: cy * scaleY + rect.top, c });
                          setChartDetail(c);
                        }}
                        onMouseEnter={() => {
                          if (!isFiltered) return;
                          const rect = svgRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          const scaleX = rect.width / CHART_W;
                          const scaleY = rect.height / CHART_H;
                          setTooltip({ x: cx * scaleX + rect.left, y: cy * scaleY + rect.top, c });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </svg>

                {tooltip && (
                  <div
                    style={{
                      position: 'fixed',
                      left: tooltip.x + 10,
                      top: tooltip.y - 10,
                      background: 'var(--color-primary)',
                      color: 'var(--color-text-light)',
                      padding: '0.6rem 0.9rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      maxWidth: '260px',
                      zIndex: 1000,
                      pointerEvents: 'none',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{tooltip.c.case_name}</div>
                    <div style={{ opacity: 0.7 }}>{tooltip.c.citation}</div>
                    <div style={{ opacity: 0.7 }}>{tooltip.c.court}</div>
                    <div style={{ marginTop: '0.3rem', color: config.colours[config.categoryOf(tooltip.c)] }}>
                      {config.categoryLabel(config.categoryOf(tooltip.c))}
                    </div>
                  </div>
                )}
              </div>

              {chartDetail && (
                <div className="cases-detail-panel" style={{ marginTop: '1rem', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)', borderRadius: 'var(--radius)', background: 'var(--color-background-warm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      {chartDetail.url ? (
                        <a href={chartDetail.url} target="_blank" rel="noopener noreferrer" className="cases-name-link" style={{ fontSize: '1rem' }}>
                          {chartDetail.case_name} ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)' }}>{chartDetail.case_name}</span>
                      )}
                      <div className="cases-citation" style={{ marginTop: '0.2rem' }}>{chartDetail.citation}</div>
                    </div>
                    <button
                      onClick={() => setChartDetail(null)}
                      style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0 0.25rem' }}
                    >
                      ×
                    </button>
                  </div>
                  {chartDetail.summary && (<><h4>Summary</h4><p>{chartDetail.summary}</p></>)}
                  {chartDetail.outcome && (<><h4>Outcome</h4><p>{chartDetail.outcome}</p></>)}
                  {chartDetail.tags.length > 0 && (
                    <>
                      <h4>Tags</h4>
                      <div className="cases-detail-tags">
                        {chartDetail.tags.map(t => (
                          <span key={t} className="cases-detail-tag">{t}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="cases-chart-legend">
                {categoryKeys.map(key => (
                  <div key={key} className="cases-legend-item">
                    <span className="cases-legend-dot" style={{ background: config.colours[key] ?? '#9ca3af' }} />
                    <span>{config.categoryLabel(key)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown view */}
          {view === 'breakdown' && (() => {
            const BD_W = 900;
            const BD_H = 320;
            const PAD2 = { top: 20, right: 20, bottom: 50, left: 44 };
            const innerW = BD_W - PAD2.left - PAD2.right;
            const innerH = BD_H - PAD2.top - PAD2.bottom;
            const maxTotal = Math.max(...trendData.map(d => d.total), 1);
            const barW = Math.min(30, Math.floor(innerW / trendData.length) - 4);
            const gap = Math.floor(innerW / trendData.length);
            const yTicks = [0, Math.ceil(maxTotal / 4), Math.ceil(maxTotal / 2), Math.ceil(maxTotal * 3 / 4), maxTotal];

            const jurData = ALL_JURISDICTIONS.filter(j => j !== 'All').map(jur => ({
              jur,
              active: filtered.filter(c => c.jurisdiction_display === jur).length,
              total: splitCases.filter(c => c.jurisdiction_display === jur).length,
            })).filter(d => d.total > 0);

            return (
              <div>
                <p className="cases-chart-hint" style={{ marginBottom: '1rem' }}>
                  Cases by year, stacked by {config.axisLabel.toLowerCase()}. Filters dim non-matching segments. Hover a bar for detail.
                </p>
                <div className="cases-chart-container" style={{ position: 'relative' }}>
                  <svg
                    viewBox={`0 0 ${BD_W} ${BD_H}`}
                    style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
                  >
                    {yTicks.map(tick => {
                      const y = PAD2.top + innerH - (tick / maxTotal) * innerH;
                      return (
                        <g key={tick}>
                          <line x1={PAD2.left} y1={y} x2={BD_W - PAD2.right} y2={y} stroke="#e8e4de" strokeWidth="1" />
                          <text x={PAD2.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{tick}</text>
                        </g>
                      );
                    })}
                    <text x={12} y={PAD2.top + innerH / 2} textAnchor="middle" fontSize="10" fill="#9ca3af" transform={`rotate(-90, 12, ${PAD2.top + innerH / 2})`}>Cases</text>

                    {trendData.map((d, i) => {
                      const x = PAD2.left + i * gap + (gap - barW) / 2;
                      let yOffset = PAD2.top + innerH;

                      const activeSegs = d.segments.map(s => ({ key: s.key, count: s.active })).filter(s => s.count > 0);
                      const dimmedTotal = d.segments.reduce((sum, s) => sum + s.dimmed, 0);

                      const rects: React.ReactNode[] = [];

                      if (dimmedTotal > 0 && hasFilter) {
                        const h = (dimmedTotal / maxTotal) * innerH;
                        yOffset -= h;
                        rects.push(<rect key="dimmed" x={x} y={yOffset} width={barW} height={h} fill="#e5e7eb" stroke="none" />);
                      }

                      for (const seg of activeSegs) {
                        const h = (seg.count / maxTotal) * innerH;
                        yOffset -= h;
                        rects.push(
                          <rect key={seg.key} x={x} y={yOffset} width={barW} height={h}
                            fill={config.colours[seg.key] ?? '#9ca3af'} fillOpacity={0.88} stroke="white" strokeWidth="0.5" />
                        );
                      }

                      const barBottom = PAD2.top + innerH;
                      const barTopY = PAD2.top + innerH - (d.total / maxTotal) * innerH;

                      return (
                        <g key={d.year}
                          onMouseEnter={e => {
                            const segs = d.segments.filter(s => s.active > 0).map(s => ({ key: s.key, count: s.active }));
                            setBdTooltip({ x: e.clientX, y: e.clientY, year: d.year, segments: segs });
                          }}
                          onMouseLeave={() => setBdTooltip(null)}
                          style={{ cursor: 'default' }}
                        >
                          <rect x={x} y={barTopY} width={barW} height={barBottom - barTopY} fill="transparent" />
                          {rects}
                          <text x={x + barW / 2} y={barBottom + 14} textAnchor="middle" fontSize="9" fill="#9ca3af">
                            {d.year}
                          </text>
                          {d.activeTotal > 0 && (
                            <text x={x + barW / 2} y={barTopY - 4} textAnchor="middle" fontSize="9" fill="#6b7280">
                              {d.activeTotal}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    <line x1={PAD2.left} y1={PAD2.top + innerH} x2={BD_W - PAD2.right} y2={PAD2.top + innerH} stroke="#d1d5db" strokeWidth="1" />
                  </svg>

                  {bdTooltip && (
                    <div style={{
                      position: 'fixed', left: bdTooltip.x + 12, top: bdTooltip.y - 10,
                      background: 'var(--color-primary)', color: 'var(--color-text-light)',
                      padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem', zIndex: 1000, pointerEvents: 'none',
                      boxShadow: 'var(--shadow-lg)', minWidth: '180px',
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{bdTooltip.year}</div>
                      {bdTooltip.segments.map(s => (
                        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: config.colours[s.key] ?? '#9ca3af', flexShrink: 0 }} />
                          <span style={{ opacity: 0.85 }}>{config.categoryLabel(s.key)}: {s.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="cases-chart-legend" style={{ marginTop: '1rem' }}>
                  {categoryKeys.map(key => (
                    <div key={key} className="cases-legend-item">
                      <span className="cases-legend-dot" style={{ background: config.colours[key] ?? '#9ca3af' }} />
                      <span>{config.categoryLabel(key)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '2rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
                    Cases by jurisdiction
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {jurData.sort((a, b) => b.total - a.total).map(d => {
                      const activePct = d.total > 0 ? (d.active / d.total) * 100 : 0;
                      const totalPct = (d.total / splitCases.length) * 100;
                      return (
                        <div key={d.jur} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '140px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', flexShrink: 0 }}>{d.jur}</div>
                          <div style={{ flex: 1, background: 'var(--color-border)', borderRadius: '4px', height: '18px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${totalPct}%`, background: 'var(--color-primary-light)', opacity: 0.25, borderRadius: '4px' }} />
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${activePct}%`, background: 'var(--color-accent)', borderRadius: '4px' }} />
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                            {hasFilter ? `${d.active} / ` : ''}{d.total}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          <p className="db-note">{data.metadata.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
