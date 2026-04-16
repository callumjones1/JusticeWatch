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
  const [view, setView] = useState<'table' | 'chart'>('table');
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

  // Live summary stats
  const liveStats = useMemo(() => {
    const total = filtered.length;
    const prohibited = filtered.filter(c => c.outcome_category === 'protest_prohibited').length;
    const allowed = filtered.filter(c => c.outcome_category === 'protest_allowed').length;
    const invalidated = filtered.filter(c => c.outcome_category === 'law_invalidated').length;
    return { total, prohibited, allowed, invalidated };
  }, [filtered]);

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
          {/* Summary stats bar */}
          <div className="db-stats-bar">
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

          {/* View tabs */}
          <div className="cases-view-tabs">
            <button
              className={`cases-tab${view === 'table' ? ' cases-tab-active' : ''}`}
              onClick={() => setView('table')}
            >
              Table
            </button>
            <button
              className={`cases-tab${view === 'chart' ? ' cases-tab-active' : ''}`}
              onClick={() => setView('chart')}
            >
              Chart
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
                    const cx = xScale(c.year) + (Math.random() * 6 - 3); // slight jitter
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

          <p className="db-note">{data.metadata.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
