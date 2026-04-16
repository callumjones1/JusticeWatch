import { useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  JURISDICTION_COLORS, JURISDICTION_BG, DECADE_COLORS, getDecade,
  type Case,
} from '../data/cases';

interface Props { cases: Case[] }

interface LeafDatum  { type: 'case';  id: string; name: string; caseRef: Case }
interface GroupDatum { type: 'group'; id: string; name: string; children: LeafDatum[] }
type RootDatum = { type: 'root'; id: string; name: string; children: GroupDatum[] };

const W = 960;
const H = 620;

function shortName(name: string): string {
  const vIdx = name.search(/\s+v\s+/i);
  const after = vIdx !== -1 ? name.slice(vIdx).replace(/^\s*v\s*/i, '') : name;
  return after.length > 18 ? after.slice(0, 16) + '…' : after;
}

export default function CaseBubbles({ cases }: Props) {
  const [selected, setSelected] = useState<Case | null>(null);

  const { groupNodes, leafNodes } = useMemo(() => {
    // Build hierarchy
    const groupMap = new Map<string, LeafDatum[]>();
    for (const c of cases) {
      if (!groupMap.has(c.jurisdiction)) groupMap.set(c.jurisdiction, []);
      groupMap.get(c.jurisdiction)!.push({ type: 'case', id: c.id, name: c.name, caseRef: c });
    }
    const children: GroupDatum[] = Array.from(groupMap.entries()).map(([j, kids]) => ({
      type: 'group', id: `grp-${j}`, name: j, children: kids,
    }));
    const root: RootDatum = { type: 'root', id: 'root', name: 'root', children };

    // D3 pack
    const hier = d3.hierarchy<RootDatum | GroupDatum | LeafDatum>(root as RootDatum)
      .sum(d => d.type === 'case' ? 1 : 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    d3.pack<RootDatum | GroupDatum | LeafDatum>()
      .size([W, H])
      .padding(n => n.depth === 0 ? 6 : 5)(hier);

    const all = hier.descendants() as d3.HierarchyCircularNode<RootDatum | GroupDatum | LeafDatum>[];
    return {
      groupNodes: all.filter(n => n.depth === 1) as d3.HierarchyCircularNode<GroupDatum>[],
      leafNodes:  all.filter(n => n.depth === 2) as d3.HierarchyCircularNode<LeafDatum>[],
    };
  }, [cases]);

  return (
    <div className="viz-container">
      <div className="viz-chart-area">
        <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg">
          {/* Jurisdiction rings */}
          {groupNodes.map(n => {
            const color = JURISDICTION_COLORS[n.data.name] ?? '#666';
            const bg    = JURISDICTION_BG[n.data.name]    ?? 'rgba(0,0,0,0.05)';
            return (
              <g key={n.data.id}>
                <circle cx={n.x} cy={n.y} r={n.r} fill={bg} stroke={color} strokeWidth={1.5} strokeDasharray="4 3" />
                <text
                  x={n.x} y={n.y - n.r + 16}
                  textAnchor="middle" fontSize={11} fontWeight={700}
                  fill={color} letterSpacing="0.06em"
                  style={{ textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none' }}
                >
                  {n.data.name} ({n.data.children.length})
                </text>
              </g>
            );
          })}

          {/* Case circles */}
          {leafNodes.map(n => {
            const c         = n.data.caseRef;
            const isSelected = selected?.id === c.id;
            const color     = DECADE_COLORS[getDecade(c.year)] ?? '#666';
            return (
              <g key={n.data.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(isSelected ? null : c)}>
                <circle
                  cx={n.x} cy={n.y} r={n.r}
                  fill={color}
                  fillOpacity={isSelected ? 1 : 0.72}
                  stroke={isSelected ? '#d4a853' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isSelected ? 2.5 : 1}
                  style={{ transition: 'all 0.18s' }}
                />
                {n.r > 13 && (
                  <text
                    x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(n.r * 0.52, 10.5)} fill="rgba(255,255,255,0.9)"
                    fontWeight={500} style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {shortName(c.name)}
                  </text>
                )}
                {c.tags.length > 0 && (
                  <circle cx={n.x + n.r * 0.6} cy={n.y - n.r * 0.6} r={4}
                    fill="#d4a853" stroke="white" strokeWidth={1}
                    style={{ pointerEvents: 'none' }} />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="viz-legend">
        <div className="viz-legend-group">
          <span className="viz-legend-title">Decade</span>
          {Object.entries(DECADE_COLORS).map(([label, color]) => (
            <span key={label} className="viz-legend-item">
              <span className="viz-legend-dot" style={{ background: color }} />{label}
            </span>
          ))}
        </div>
        <div className="viz-legend-group">
          <span className="viz-legend-item">
            <span className="viz-legend-dot" style={{ background: '#d4a853' }} />Has tags
          </span>
        </div>
        <div className="viz-legend-group">
          <span className="viz-legend-item viz-legend-muted">{cases.length} cases · click a bubble to inspect</span>
        </div>
      </div>

      {selected && (
        <CaseDetail c={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CaseDetail({ c, onClose }: { c: Case; onClose: () => void }) {
  return (
    <div className="viz-detail">
      <button className="viz-detail-close" onClick={onClose} aria-label="Close">×</button>
      <div className="viz-detail-jur" style={{ color: JURISDICTION_COLORS[c.jurisdiction] ?? '#555' }}>
        {c.jurisdiction} · {c.year}
      </div>
      <h3 className="viz-detail-name">{c.name}</h3>
      <div className="viz-detail-citation">{c.citation}</div>
      {c.tags.length > 0 && (
        <div className="viz-detail-tags">{c.tags.map(t => <span key={t} className="db-tag">{t}</span>)}</div>
      )}
      {c.charges  && <div className="viz-detail-field"><strong>Charges:</strong> {c.charges}</div>}
      {c.outcome  && <div className="viz-detail-field"><strong>Outcome:</strong> {c.outcome}</div>}
      {c.summary  && <div className="viz-detail-field">{c.summary}</div>}
      <a href={c.link} target="_blank" rel="noopener noreferrer" className="viz-detail-link">
        View on AustLII
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    </div>
  );
}
