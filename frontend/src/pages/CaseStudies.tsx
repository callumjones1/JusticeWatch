import { useState, useMemo, useRef, useEffect } from 'react';
import data from '../data/protest_cases.json';

type Case = {
  id: string;
  case_name: string;
  citation: string;
  year: number;
  court: string;
  jurisdiction: string;
  jurisdiction_normalised: string;
  forum_level: 'State' | 'Federal' | 'HCA';
  proceeding_type: string;
  protest_context: string;
  main_issue: string;
  outcome: string;
  outcome_category: string;
  charges: string;
  tags: string[];
  url: string;
};

const cases = data.cases as Case[];
const outcomeCategories = data.outcome_categories as Record<string, string>;

const MIN_YEAR = Math.min(...cases.map(c => c.year));
const MAX_YEAR = Math.max(...cases.map(c => c.year));
const ALL_JURISDICTIONS = ['All', ...Array.from(new Set(cases.map(c => c.jurisdiction_normalised))).sort()];
const ALL_FORUM_LEVELS = ['All', 'State', 'Federal', 'HCA'];
const ALL_PROCEEDING_TYPES = ['All', ...Array.from(new Set(cases.map(c => c.proceeding_type))).sort()];
const ALL_TAGS = Array.from(new Set(cases.flatMap(c => c.tags))).sort();

const OUTCOME_COLOURS: Record<string, string> = {
  protest_prohibited:       '#dc2626',
  protest_allowed:          '#16a34a',
  law_invalidated:          '#0d9488',
  law_upheld:               '#d97706',
  appeal_allowed:           '#4ade80',
  appeal_dismissed:         '#fca5a5',
  protester_unsuccessful:   '#f97316',
  other:                    '#9ca3af',
};

function outcomeLabel(cat: string): string {
  return outcomeCategories[cat] ?? cat.replace(/_/g, ' ');
}

// Scatter chart constants
const CHART_W = 800;
const CHART_H = 300;
const PAD = { top: 24, right: 24, bottom: 40, left: 80 };
const FORUM_Y: Record<string, number> = { 'State': 0.8, 'Federal': 0.5, 'HCA': 0.15 };

export default function CaseStudies() {
  const [view, setView] = useState<'table' | 'chart' | 'breakdown'>('table');
  const [yearFrom, setYearFrom] = useState(MIN_YEAR);
  const [yearTo, setYearTo] = useState(MAX_YEAR);
  const [filterJur, setFilterJur] = useState('All');
  const [filterForum, setFilterForum] = useState('All');
  const [filterProceeding, setFilterProceeding] = useState('All');
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<'year' | 'case_name' | 'court' | 'jurisdiction_normalised' | 'forum_level' | 'proceeding_type'>('year');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; c: Case } | null>(null);
  const [chartDetail, setChartDetail] = useState<Case | null>(null);
  const [bdTooltip, setBdTooltip] = useState<{ x: number; y: number; year: number; segments: { key: string; count: number }[] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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
    setFilterProceeding('All');
    setFilterTags(new Set());
  }

  const hasFilter = yearFrom !== MIN_YEAR || yearTo !== MAX_YEAR ||
    filterJur !== 'All' || filterForum !== 'All' ||
    filterProceeding !== 'All' || filterTags.size > 0;

  const filtered = useMemo(() => cases.filter(c => {
    if (c.year < yearFrom || c.year > yearTo) return false;
    if (filterJur !== 'All' && c.jurisdiction_normalised !== filterJur) return false;
    if (filterForum !== 'All' && c.forum_level !== filterForum) return false;
    if (filterProceeding !== 'All' && c.proceeding_type !== filterProceeding) return false;
    if (filterTags.size > 0 && !c.tags.some(t => filterTags.has(t))) return false;
    return true;
  }), [yearFrom, yearTo, filterJur, filterForum, filterProceeding, filterTags]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] as string | number;
      const bv = b[sortCol] as string | number;
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

  // Breakdown data: per-year stacked by outcome
  const OUTCOME_KEYS = Object.keys(OUTCOME_COLOURS);
  const trendData = useMemo(() => {
    const years = [...new Set(cases.map(c => c.year))].sort();
    return years.map(year => {
      const yearCases = cases.filter(c => c.year === year);
      const segments = OUTCOME_KEYS.map(key => ({
        key,
        active: yearCases.filter(c => c.outcome_category === key && filtered.includes(c)).length,
        dimmed: yearCases.filter(c => c.outcome_category === key && !filtered.includes(c)).length,
      }));
      return { year, segments, total: yearCases.length, activeTotal: filtered.filter(c => c.year === year).length };
    });
  }, [filtered]);

  // Live summary stats
  const liveStats = useMemo(() => {
    const total = filtered.length;
    const prohibited = filtered.filter(c => c.outcome_category === 'protest_prohibited').length;
    const allowed = filtered.filter(c => c.outcome_category === 'protest_allowed').length;
    const invalidated = filtered.filter(c => c.outcome_category === 'law_invalidated').length;
    const other = total - prohibited - allowed - invalidated;
    return { total, prohibited, allowed, invalidated, other };
  }, [filtered]);

  // Pie chart segments (protest_prohibited, protest_allowed, law_invalidated, other)
  const pieSegments = useMemo(() => {
    const slices = [
      { label: 'Protest Prohibited', count: liveStats.prohibited,  color: OUTCOME_COLOURS.protest_prohibited },
      { label: 'Protest Allowed',    count: liveStats.allowed,     color: OUTCOME_COLOURS.protest_allowed },
      { label: 'Law Invalidated',    count: liveStats.invalidated, color: OUTCOME_COLOURS.law_invalidated },
      { label: 'Other',              count: liveStats.other,       color: OUTCOME_COLOURS.other },
    ].filter(s => s.count > 0);

    const total = liveStats.total;
    if (total === 0) return [];

    let angle = -Math.PI / 2; // start at 12 o'clock
    return slices.map(s => {
      const sweep = (s.count / total) * 2 * Math.PI;
      const start = angle;
      angle += sweep;
      return { ...s, start, end: angle, sweep };
    });
  }, [liveStats]);

  function pieArcPath(cx: number, cy: number, r: number, start: number, end: number): string {
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  // Chart helpers
  const xScale = (year: number) => {
    const range = MAX_YEAR - MIN_YEAR || 1;
    return PAD.left + ((year - MIN_YEAR) / range) * (CHART_W - PAD.left - PAD.right);
  };
  const yScale = (forum: string) => {
    const t = FORUM_Y[forum] ?? 0.5;
    return PAD.top + t * (CHART_H - PAD.top - PAD.bottom);
  };

  const xTicks = Array.from(new Set(cases.map(c => c.year))).sort();
  const displayXTicks = xTicks.filter(y => (y - MIN_YEAR) % 3 === 0 || y === MIN_YEAR || y === MAX_YEAR);

  // Close tooltip on outside click
  useEffect(() => {
    function handler() { setTooltip(null); }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Case Studies</h1>
          <p className="page-subtitle">{data.metadata.description}</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {/* Summary stats + pie chart */}
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'stretch', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {/* Stat tiles */}
            <div className="db-stats-bar" style={{ flex: '1', minWidth: '280px', margin: 0 }}>
              <div className="db-stat-tile">
                <span className="db-stat-num">{liveStats.total}</span>
                <span className="db-stat-label">Total Cases</span>
              </div>
              <div className="db-stat-tile">
                <span className="db-stat-num" style={{ color: OUTCOME_COLOURS.protest_prohibited }}>{liveStats.prohibited}</span>
                <span className="db-stat-label">Protests Prohibited</span>
              </div>
              <div className="db-stat-tile">
                <span className="db-stat-num" style={{ color: OUTCOME_COLOURS.protest_allowed }}>{liveStats.allowed}</span>
                <span className="db-stat-label">Protests Allowed</span>
              </div>
              <div className="db-stat-tile">
                <span className="db-stat-num" style={{ color: OUTCOME_COLOURS.law_invalidated }}>{liveStats.invalidated}</span>
                <span className="db-stat-label">Laws Invalidated</span>
              </div>
            </div>

            {/* Pie chart panel */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1.5rem',
              background: 'var(--color-background-warm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '1.25rem 1.75rem',
              flexShrink: 0,
            }}>
              <svg width="160" height="160" viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
                {liveStats.total === 0
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  { label: 'Protest Prohibited', count: liveStats.prohibited,  color: OUTCOME_COLOURS.protest_prohibited },
                  { label: 'Protest Allowed',    count: liveStats.allowed,     color: OUTCOME_COLOURS.protest_allowed },
                  { label: 'Law Invalidated',    count: liveStats.invalidated, color: OUTCOME_COLOURS.law_invalidated },
                  { label: 'Other',              count: liveStats.other,       color: OUTCOME_COLOURS.other },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
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
                {ALL_FORUM_LEVELS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="cases-filter-group">
              <span className="cases-filter-label">Proceeding type</span>
              <select className="cases-filter-select" value={filterProceeding} onChange={e => setFilterProceeding(e.target.value)}>
                {ALL_PROCEEDING_TYPES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="cases-filter-group" style={{ flexBasis: '100%' }}>
              <span className="cases-filter-label">Tags</span>
              <div className="cases-tags-pills">
                {ALL_TAGS.map(t => (
                  <button
                    key={t}
                    className={`cases-tag-pill${filterTags.has(t) ? ' cases-tag-pill-active' : ''}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
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
                    {(['year', 'case_name', 'citation', 'court', 'jurisdiction_normalised', 'forum_level', 'proceeding_type'] as const).map(col => {
                      const labels: Record<string, string> = {
                        year: 'Year', case_name: 'Case Name', citation: 'Citation',
                        court: 'Court', jurisdiction_normalised: 'Jurisdiction',
                        forum_level: 'Forum', proceeding_type: 'Proceeding Type',
                      };
                      const sortable = ['year', 'case_name', 'court', 'jurisdiction_normalised', 'forum_level', 'proceeding_type'].includes(col);
                      return (
                        <th
                          key={col}
                          className="cases-th"
                          onClick={sortable ? () => handleSort(col as typeof sortCol) : undefined}
                          style={sortable ? { cursor: 'pointer' } : {}}
                        >
                          {labels[col]}
                          {sortable && (
                            <span className={`sort-indicator${sortCol === col ? ' sort-indicator-active' : ''}`}>
                              {sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                            </span>
                          )}
                        </th>
                      );
                    })}
                    <th className="cases-th">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        No cases match the current filters.
                      </td>
                    </tr>
                  )}
                  {sorted.map(c => {
                    const isOpen = openRow === c.id;
                    return [
                      <tr
                        key={c.id}
                        className={`cases-row${!filtered.includes(c) ? ' cases-row-dimmed' : ''}`}
                        onClick={() => setOpenRow(isOpen ? null : c.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="cases-td cases-td-year">{c.year}</td>
                        <td className="cases-td">
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cases-name-link"
                            onClick={e => e.stopPropagation()}
                          >
                            {c.case_name}
                          </a>
                        </td>
                        <td className="cases-td cases-citation">{c.citation}</td>
                        <td className="cases-td" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{c.court}</td>
                        <td className="cases-td" style={{ fontSize: '0.85rem' }}>{c.jurisdiction_normalised}</td>
                        <td className="cases-td" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{c.forum_level}</td>
                        <td className="cases-td" style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{c.proceeding_type}</td>
                        <td className="cases-td">
                          <span
                            className="cases-outcome-badge"
                            style={{
                              backgroundColor: OUTCOME_COLOURS[c.outcome_category] + '22',
                              color: OUTCOME_COLOURS[c.outcome_category],
                              border: `1px solid ${OUTCOME_COLOURS[c.outcome_category]}44`,
                            }}
                          >
                            {outcomeLabel(c.outcome_category)}
                          </span>
                        </td>
                      </tr>,
                      isOpen && (
                        <tr key={`${c.id}-detail`} className="cases-detail-row">
                          <td colSpan={8}>
                            <div className="cases-detail-panel">
                              <h4>Protest context</h4>
                              <p>{c.protest_context}</p>
                              <h4>Main issue</h4>
                              <p>{c.main_issue}</p>
                              <h4>Outcome</h4>
                              <p>{c.outcome}</p>
                              {c.charges && c.charges !== 'N/A' && (
                                <>
                                  <h4>Charges</h4>
                                  <p>{c.charges}</p>
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
                X-axis: year · Y-axis: court level (State → Federal → HCA) · Colour: outcome · Click a dot to inspect · Filtered-out cases are dimmed
              </p>
              <div style={{ position: 'relative' }}>
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                  {/* Y axis labels */}
                  {(['State', 'Federal', 'HCA'] as const).map(f => (
                    <text key={f} x={PAD.left - 8} y={yScale(f) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                      {f}
                    </text>
                  ))}

                  {/* Y axis grid lines */}
                  {(['State', 'Federal', 'HCA'] as const).map(f => (
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

                  {/* X axis ticks */}
                  {displayXTicks.map(y => (
                    <g key={y}>
                      <line x1={xScale(y)} y1={CHART_H - PAD.bottom + 4} x2={xScale(y)} y2={CHART_H - PAD.bottom} stroke="#9ca3af" strokeWidth="1" />
                      <text x={xScale(y)} y={CHART_H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill="#6b7280">{y}</text>
                    </g>
                  ))}

                  {/* Axis line */}
                  <line x1={PAD.left} y1={CHART_H - PAD.bottom} x2={CHART_W - PAD.right} y2={CHART_H - PAD.bottom} stroke="#d1d5db" strokeWidth="1" />

                  {/* Case dots */}
                  {cases.map(c => {
                    const isFiltered = filtered.includes(c);
                    const cx = xScale(c.year) + djitter(c.id);
                    const cy = yScale(c.forum_level);
                    const colour = OUTCOME_COLOURS[c.outcome_category] ?? '#9ca3af';
                    return (
                      <circle
                        key={c.id}
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill={colour}
                        fillOpacity={isFiltered ? 0.85 : 0.12}
                        stroke={colour}
                        strokeWidth={isFiltered ? 1.5 : 0.5}
                        strokeOpacity={isFiltered ? 1 : 0.3}
                        style={{ cursor: isFiltered ? 'pointer' : 'default', transition: 'fill-opacity 0.3s' }}
                        onClick={e => {
                          e.stopPropagation();
                          if (!isFiltered) return;
                          const rect = svgRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          const svgW = CHART_W;
                          const scaleX = rect.width / svgW;
                          const scaleY = rect.height / CHART_H;
                          setTooltip({ x: cx * scaleX + rect.left, y: cy * scaleY + rect.top, c });
                          setChartDetail(c);
                        }}
                        onMouseEnter={_e => {
                          if (!isFiltered) return;
                          const rect = svgRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          const svgW = CHART_W;
                          const scaleX = rect.width / svgW;
                          const scaleY = rect.height / CHART_H;
                          setTooltip({ x: cx * scaleX + rect.left, y: cy * scaleY + rect.top, c });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </svg>

                {/* Tooltip */}
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
                    <div style={{ marginTop: '0.3rem', color: OUTCOME_COLOURS[tooltip.c.outcome_category] }}>
                      {outcomeLabel(tooltip.c.outcome_category)}
                    </div>
                  </div>
                )}
              </div>

              {/* Chart detail panel */}
              {chartDetail && (
                <div className="cases-detail-panel" style={{ marginTop: '1rem', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent)', borderRadius: 'var(--radius)', background: 'var(--color-background-warm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <a href={chartDetail.url} target="_blank" rel="noopener noreferrer" className="cases-name-link" style={{ fontSize: '1rem' }}>
                        {chartDetail.case_name} ↗
                      </a>
                      <div className="cases-citation" style={{ marginTop: '0.2rem' }}>{chartDetail.citation}</div>
                    </div>
                    <button
                      onClick={() => setChartDetail(null)}
                      style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0 0.25rem' }}
                    >
                      ×
                    </button>
                  </div>
                  <h4>Protest context</h4>
                  <p>{chartDetail.protest_context}</p>
                  <h4>Main issue</h4>
                  <p>{chartDetail.main_issue}</p>
                  <h4>Outcome</h4>
                  <p>{chartDetail.outcome}</p>
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

              {/* Legend */}
              <div className="cases-chart-legend">
                {Object.entries(OUTCOME_COLOURS).map(([cat, colour]) => (
                  <div key={cat} className="cases-legend-item">
                    <span className="cases-legend-dot" style={{ background: colour }} />
                    <span>{outcomeLabel(cat)}</span>
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
            const barW = Math.min(38, Math.floor(innerW / trendData.length) - 6);
            const gap = Math.floor(innerW / trendData.length);
            const yTicks = [0, Math.ceil(maxTotal / 4), Math.ceil(maxTotal / 2), Math.ceil(maxTotal * 3 / 4), maxTotal];

            // Per-jurisdiction breakdown (right panel)
            const jurData = ALL_JURISDICTIONS.filter(j => j !== 'All').map(jur => ({
              jur,
              active: filtered.filter(c => c.jurisdiction_normalised === jur).length,
              total: cases.filter(c => c.jurisdiction_normalised === jur).length,
            })).filter(d => d.total > 0);

            return (
              <div>
                <p className="cases-chart-hint" style={{ marginBottom: '1rem' }}>
                  Cases by year, stacked by outcome. Filters dim non-matching segments. Hover a bar for detail.
                </p>
                <div className="cases-chart-container" style={{ position: 'relative' }}>
                  <svg
                    viewBox={`0 0 ${BD_W} ${BD_H}`}
                    style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
                  >
                    {/* Y axis grid + ticks */}
                    {yTicks.map(tick => {
                      const y = PAD2.top + innerH - (tick / maxTotal) * innerH;
                      return (
                        <g key={tick}>
                          <line x1={PAD2.left} y1={y} x2={BD_W - PAD2.right} y2={y} stroke="#e8e4de" strokeWidth="1" />
                          <text x={PAD2.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{tick}</text>
                        </g>
                      );
                    })}

                    {/* Y axis label */}
                    <text x={12} y={PAD2.top + innerH / 2} textAnchor="middle" fontSize="10" fill="#9ca3af" transform={`rotate(-90, 12, ${PAD2.top + innerH / 2})`}>Cases</text>

                    {/* Bars */}
                    {trendData.map((d, i) => {
                      const x = PAD2.left + i * gap + (gap - barW) / 2;
                      let yOffset = PAD2.top + innerH;

                      // Build stacked segments: active first, then dimmed (grey)
                      const activeSegs = d.segments.map(s => ({ key: s.key, count: s.active })).filter(s => s.count > 0);
                      const dimmedTotal = d.segments.reduce((sum, s) => sum + s.dimmed, 0);

                      const rects: React.ReactNode[] = [];

                      // Dimmed (grey) segment at bottom
                      if (dimmedTotal > 0 && hasFilter) {
                        const h = (dimmedTotal / maxTotal) * innerH;
                        yOffset -= h;
                        rects.push(
                          <rect key="dimmed" x={x} y={yOffset} width={barW} height={h}
                            fill="#e5e7eb" stroke="none" />
                        );
                      }

                      // Active colored segments
                      for (const seg of activeSegs) {
                        const h = (seg.count / maxTotal) * innerH;
                        yOffset -= h;
                        rects.push(
                          <rect key={seg.key} x={x} y={yOffset} width={barW} height={h}
                            fill={OUTCOME_COLOURS[seg.key] ?? '#9ca3af'}
                            fillOpacity={0.88}
                            stroke="white" strokeWidth="0.5"
                          />
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
                          {/* Invisible hit area */}
                          <rect x={x} y={barTopY} width={barW} height={barBottom - barTopY} fill="transparent" />
                          {rects}
                          {/* Year label */}
                          <text
                            x={x + barW / 2}
                            y={barBottom + 14}
                            textAnchor="middle"
                            fontSize="9"
                            fill={d.year === 2020 ? '#1d3a5c' : '#9ca3af'}
                            fontWeight={d.year === 2020 ? '700' : '400'}
                          >
                            {d.year}
                          </text>
                          {/* Count label above bar */}
                          {d.activeTotal > 0 && (
                            <text x={x + barW / 2} y={barTopY - 4} textAnchor="middle" fontSize="9" fill="#6b7280">
                              {d.activeTotal}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Axis line */}
                    <line x1={PAD2.left} y1={PAD2.top + innerH} x2={BD_W - PAD2.right} y2={PAD2.top + innerH} stroke="#d1d5db" strokeWidth="1" />

                    {/* 2020 annotation */}
                    {(() => {
                      const idx = trendData.findIndex(d => d.year === 2020);
                      if (idx < 0) return null;
                      const x = PAD2.left + idx * gap + (gap - barW) / 2 + barW / 2;
                      return (
                        <text x={x} y={PAD2.top + 8} textAnchor="middle" fontSize="9" fill="var(--color-accent)" fontWeight="600">
                          COVID cluster
                        </text>
                      );
                    })()}
                  </svg>

                  {/* Tooltip */}
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
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: OUTCOME_COLOURS[s.key] ?? '#9ca3af', flexShrink: 0 }} />
                          <span style={{ opacity: 0.85 }}>{outcomeLabel(s.key)}: {s.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="cases-chart-legend" style={{ marginTop: '1rem' }}>
                  {OUTCOME_KEYS.map(key => (
                    <div key={key} className="cases-legend-item">
                      <span className="cases-legend-dot" style={{ background: OUTCOME_COLOURS[key] }} />
                      <span>{outcomeLabel(key)}</span>
                    </div>
                  ))}
                </div>

                {/* Jurisdiction breakdown */}
                <div style={{ marginTop: '2rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
                    Cases by jurisdiction
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {jurData.sort((a, b) => b.total - a.total).map(d => {
                      const activePct = d.total > 0 ? (d.active / d.total) * 100 : 0;
                      const totalPct = (d.total / cases.length) * 100;
                      return (
                        <div key={d.jur} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '120px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', flexShrink: 0 }}>{d.jur}</div>
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

                {/* Court level breakdown */}
                <div style={{ marginTop: '2rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
                    Outcome distribution
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {OUTCOME_KEYS.map(key => {
                      const total = cases.filter(c => c.outcome_category === key).length;
                      const active = filtered.filter(c => c.outcome_category === key).length;
                      if (total === 0) return null;
                      return (
                        <div key={key} style={{
                          flex: '1', minWidth: '140px',
                          background: OUTCOME_COLOURS[key] + '12',
                          border: `1px solid ${OUTCOME_COLOURS[key]}33`,
                          borderRadius: 'var(--radius)',
                          padding: '0.85rem 1rem',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: OUTCOME_COLOURS[key], fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                            {hasFilter ? active : total}
                          </div>
                          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginTop: '0.3rem', fontWeight: 600 }}>
                            {outcomeLabel(key)}
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
