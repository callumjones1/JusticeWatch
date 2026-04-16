import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { JURISDICTION_COLORS, extractParties, type Case } from '../data/cases';

interface Props { cases: Case[] }

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'case' | 'entity';
  label: string;
  caseRef?: Case;
  entityKind?: 'party' | 'tag';
  jurisdiction?: string;
  _rw?: number; _rh?: number;
}
interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  kind: 'party' | 'tag';
}

function buildGraph(cases: Case[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const entityMap = new Map<string, GraphNode>();
  const entityDegree = new Map<string, number>();

  const getEntity = (label: string, kind: 'party' | 'tag'): GraphNode => {
    const key = `${kind}::${label}`;
    if (!entityMap.has(key)) {
      const n: GraphNode = { id: `entity-${key}`, type: 'entity', label, entityKind: kind };
      entityMap.set(key, n);
      nodes.push(n);
    }
    return entityMap.get(key)!;
  };

  for (const c of cases) {
    nodes.push({ id: c.id, type: 'case', label: c.name, caseRef: c, jurisdiction: c.jurisdiction });

    for (const party of extractParties(c.name)) {
      const e = getEntity(party, 'party');
      links.push({ source: c.id, target: e.id, kind: 'party' });
      entityDegree.set(e.id, (entityDegree.get(e.id) ?? 0) + 1);
    }
    for (const tag of c.tags) {
      const e = getEntity(tag, 'tag');
      links.push({ source: c.id, target: e.id, kind: 'tag' });
      entityDegree.set(e.id, (entityDegree.get(e.id) ?? 0) + 1);
    }
  }

  // Keep only entities that connect ≥2 cases (hubs), or any tag entity
  const keepIds = new Set([
    ...nodes.filter(n => n.type === 'case').map(n => n.id),
    ...nodes.filter(n => n.type === 'entity' && (
      (entityDegree.get(n.id) ?? 0) >= 2 || n.entityKind === 'tag'
    )).map(n => n.id),
  ]);

  const filteredNodes = nodes.filter(n => keepIds.has(n.id));
  const filteredLinks = links.filter(l => {
    const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
    const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
    return keepIds.has(s) && keepIds.has(t);
  });

  return { nodes: filteredNodes, links: filteredLinks };
}

const W = 960, H = 640;

export default function CaseNetwork({ cases }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<Case | null>(null);
  const onSelectRef = useRef<(c: Case | null) => void>(() => {});
  onSelectRef.current = setSelected;

  useEffect(() => {
    if (!svgRef.current || cases.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { nodes, links } = buildGraph(cases);

    const g = svg.append('g');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.25, 4])
        .on('zoom', e => g.attr('transform', e.transform))
    );

    // Links
    const linkSel = g.append('g').selectAll<SVGLineElement, GraphLink>('line')
      .data(links).join('line')
      .attr('stroke', d => d.kind === 'tag' ? '#d4a853' : 'rgba(100,120,160,0.22)')
      .attr('stroke-width', d => d.kind === 'tag' ? 1.8 : 1);

    // Entity nodes (pill labels)
    const entityG = g.append('g').selectAll<SVGGElement, GraphNode>('g')
      .data(nodes.filter(n => n.type === 'entity'))
      .join('g').style('cursor', 'default');

    entityG.append('rect').attr('rx', 5)
      .attr('fill', d => d.entityKind === 'tag' ? 'rgba(212,168,83,0.15)' : 'rgba(180,195,220,0.18)')
      .attr('stroke', d => d.entityKind === 'tag' ? '#d4a853' : 'rgba(100,130,175,0.45)')
      .attr('stroke-width', 1.5);

    entityG.append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-size', 10).attr('font-weight', 600)
      .attr('fill', d => d.entityKind === 'tag' ? '#8a5c10' : '#3a4a6a')
      .attr('pointer-events', 'none').attr('user-select', 'none');

    // Size rects to fit text
    entityG.each(function(d) {
      const bbox = d3.select(this).select<SVGTextElement>('text').node()?.getBBox();
      if (!bbox) return;
      const pw = bbox.width + 16, ph = bbox.height + 10;
      d3.select(this).select('rect').attr('x', -pw / 2).attr('y', -ph / 2).attr('width', pw).attr('height', ph);
      d._rw = pw; d._rh = ph;
    });

    // Case nodes
    const caseG = g.append('g').selectAll<SVGGElement, GraphNode>('g')
      .data(nodes.filter(n => n.type === 'case'))
      .join('g').attr('class', 'case-node').style('cursor', 'pointer')
      .on('click', (_e, d) => onSelectRef.current(d.caseRef ?? null));

    caseG.append('circle').attr('r', 9)
      .attr('fill', d => JURISDICTION_COLORS[d.jurisdiction ?? ''] ?? '#555')
      .attr('fill-opacity', 0.82)
      .attr('stroke', 'rgba(255,255,255,0.4)').attr('stroke-width', 1.5);

    // Gold dot for cases with tags
    caseG.filter(d => (d.caseRef?.tags.length ?? 0) > 0)
      .append('circle').attr('r', 3.5).attr('cx', 6).attr('cy', -6)
      .attr('fill', '#d4a853').attr('stroke', 'white').attr('stroke-width', 1)
      .attr('pointer-events', 'none');

    // Hover tooltip
    const tooltip = svg.append('g').attr('class', 'net-tooltip').style('display', 'none');
    const tooltipRect = tooltip.append('rect').attr('rx', 5)
      .attr('fill', 'white').attr('stroke', '#e8e4de').attr('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))');
    const tooltipText = tooltip.append('text')
      .attr('font-size', 11).attr('fill', '#1a1a1a').attr('pointer-events', 'none');

    caseG
      .on('mouseenter', function(_e, d) {
        d3.select(this).select('circle').attr('r', 13).attr('fill-opacity', 1)
          .attr('stroke', '#d4a853').attr('stroke-width', 2.5);
        tooltipText.text(d.label);
        const bb = tooltipText.node()?.getBBox();
        if (bb) {
          const pw = bb.width + 14, ph = bb.height + 8;
          tooltipRect.attr('x', -pw / 2).attr('y', -ph / 2).attr('width', pw).attr('height', ph);
          tooltipText.attr('text-anchor', 'middle').attr('dominant-baseline', 'middle');
          tooltip.style('display', null)
            .attr('transform', `translate(${(d.x ?? 0)},${(d.y ?? 0) - 26})`);
        }
      })
      .on('mouseleave', function() {
        d3.select(this).select('circle').attr('r', 9).attr('fill-opacity', 0.82)
          .attr('stroke', 'rgba(255,255,255,0.4)').attr('stroke-width', 1.5);
        tooltip.style('display', 'none');
      });

    // Force simulation
    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => d.kind === 'tag' ? 55 : 78)
        .strength(d => d.kind === 'tag' ? 0.9 : 0.35))
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(d => d.type === 'entity' ? -280 : -100))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<GraphNode>()
        .radius(d => d.type === 'entity' ? (d._rw ?? 60) / 2 + 5 : 15)
        .strength(0.85));

    sim.on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0);
      caseG.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
      entityG.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
      tooltip.raise(); // always on top
    });

    // Drag
    caseG.call(
      d3.drag<SVGGElement, GraphNode>()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

    return () => { sim.stop(); };
  }, [cases]);

  // Highlight selected case node
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, GraphNode>('.case-node circle:first-child')
      .attr('stroke', d => d.caseRef?.id === selected?.id ? '#d4a853' : 'rgba(255,255,255,0.4)')
      .attr('stroke-width', d => d.caseRef?.id === selected?.id ? 3 : 1.5)
      .attr('r', d => d.caseRef?.id === selected?.id ? 13 : 9)
      .attr('fill-opacity', d => d.caseRef?.id === selected?.id ? 1 : 0.82);
  }, [selected]);

  return (
    <div className="viz-container">
      <div className="viz-chart-area">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="viz-svg" />
        <p className="viz-network-hint">Drag to rearrange · scroll to zoom · click a case circle to inspect</p>
      </div>

      <div className="viz-legend">
        <div className="viz-legend-group">
          <span className="viz-legend-title">Jurisdiction</span>
          {Object.entries(JURISDICTION_COLORS).filter(([j]) =>
            cases.some(c => c.jurisdiction === j)
          ).map(([j, color]) => (
            <span key={j} className="viz-legend-item">
              <span className="viz-legend-dot" style={{ background: color }} />{j}
            </span>
          ))}
        </div>
        <div className="viz-legend-group">
          <span className="viz-legend-title">Connections</span>
          <span className="viz-legend-item">
            <span className="viz-legend-dot" style={{ background: 'rgba(180,195,220,0.4)', border: '1.5px solid rgba(100,130,175,0.5)' }} />Shared party
          </span>
          <span className="viz-legend-item">
            <span className="viz-legend-dot" style={{ background: 'rgba(212,168,83,0.2)', border: '1.5px solid #d4a853' }} />Tag label
          </span>
        </div>
      </div>

      {selected && (
        <div className="viz-detail">
          <button className="viz-detail-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          <div className="viz-detail-jur" style={{ color: JURISDICTION_COLORS[selected.jurisdiction] ?? '#555' }}>
            {selected.jurisdiction} · {selected.year}
          </div>
          <h3 className="viz-detail-name">{selected.name}</h3>
          <div className="viz-detail-citation">{selected.citation}</div>
          {selected.tags.length > 0 && (
            <div className="viz-detail-tags">{selected.tags.map(t => <span key={t} className="db-tag">{t}</span>)}</div>
          )}
          {selected.charges && <div className="viz-detail-field"><strong>Charges:</strong> {selected.charges}</div>}
          {selected.outcome && <div className="viz-detail-field"><strong>Outcome:</strong> {selected.outcome}</div>}
          {selected.summary && <div className="viz-detail-field">{selected.summary}</div>}
          <a href={selected.link} target="_blank" rel="noopener noreferrer" className="viz-detail-link">
            View on AustLII
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
