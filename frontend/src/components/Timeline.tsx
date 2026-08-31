import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export type TimelineType = 'legislation' | 'incident' | 'case';
export type TimelineRegister = 'protest' | 'political_violence';

export interface TimelineLegislationItem { id: string; label: string; year: number; }
export interface TimelineIncidentItem { id: string; label: string; year: number; }
export interface TimelineCaseItem { id: string; label: string; year: number; register: TimelineRegister; url: string | null; }
export interface TimelineEdge { caseId: string; legislationId: string; }

export interface TimelineHandle {
  resetZoom: () => void;
}

export interface TimelineSelection {
  type: TimelineType;
  id: string;
  label: string;
  year: number;
  sub: string;
  linked: { id: string; label: string; year: number; url?: string | null }[];
  yearCounts?: { year: number; count: number }[];
}

interface TimelineProps {
  legislation: TimelineLegislationItem[];
  incidents: TimelineIncidentItem[];
  cases: TimelineCaseItem[];
  edges: TimelineEdge[];
  minYear: number;
  maxYear: number;
  height?: number;
  typeColours: Record<TimelineType, string>;
  registerColours: Record<TimelineRegister, string>;
  cmdRef?: React.MutableRefObject<TimelineHandle | null>;
  onSelect: (sel: TimelineSelection | null) => void;
}

const LANE_ORDER: TimelineType[] = ['legislation', 'incident', 'case'];
const LANE_LABEL: Record<TimelineType, string> = { legislation: 'Legislation', incident: 'Incidents', case: 'Cases' };
const MARGIN = { top: 34, right: 32, bottom: 40, left: 96 };

function hashJitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

interface PosItem {
  id: string;
  type: TimelineType;
  label: string;
  year: number;
  register?: TimelineRegister;
  url?: string | null;
  degree: number;
  laneY: number;
}

export default function Timeline({
  legislation, incidents, cases, edges, minYear, maxYear, height = 640,
  typeColours, registerColours, cmdRef, onSelect,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl) return;

    const W = container.clientWidth || 900;
    const H = height;
    const innerW = Math.max(100, W - MARGIN.left - MARGIN.right);
    const innerH = Math.max(100, H - MARGIN.top - MARGIN.bottom);

    const laneH = innerH / LANE_ORDER.length;
    const laneCenter: Record<TimelineType, number> = {
      legislation: MARGIN.top + laneH * 0.5,
      incident: MARGIN.top + laneH * 1.5,
      case: MARGIN.top + laneH * 2 + laneH * 0.5,
    };
    const caseBandTop = MARGIN.top + laneH * 2 + 10;
    const caseBandHeight = laneH - 20;

    const legislationIds = new Set(legislation.map(l => l.id));
    const caseIds = new Set(cases.map(c => c.id));
    const edgesInView = edges.filter(e => legislationIds.has(e.legislationId) && caseIds.has(e.caseId));

    const degreeByLegislation = new Map<string, number>();
    edgesInView.forEach(e => degreeByLegislation.set(e.legislationId, (degreeByLegislation.get(e.legislationId) ?? 0) + 1));
    const maxDegree = Math.max(1, ...degreeByLegislation.values());
    const legRadius = d3.scaleSqrt().domain([0, maxDegree]).range([4, 15]);

    const items: PosItem[] = [
      ...legislation.map(l => ({ id: l.id, type: 'legislation' as const, label: l.label, year: l.year, degree: degreeByLegislation.get(l.id) ?? 0, laneY: laneCenter.legislation })),
      ...incidents.map(i => ({ id: i.id, type: 'incident' as const, label: i.label, year: i.year, degree: 0, laneY: laneCenter.incident })),
      ...cases.map(c => ({ id: c.id, type: 'case' as const, label: c.label, year: c.year, register: c.register, url: c.url, degree: 0, laneY: caseBandTop + hashJitter(c.id) * caseBandHeight })),
    ];
    const itemById = new Map(items.map(it => [it.id, it]));

    d3.select(container).selectAll('.ng-overlay').remove();

    const svg = d3.select(svgEl).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent');

    const xScale = d3.scaleLinear().domain([minYear, maxYear]).range([0, innerW]).clamp(true);

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},0)`);

    // Lane labels + separators
    LANE_ORDER.forEach(t => {
      svg.append('text')
        .attr('x', MARGIN.left - 12)
        .attr('y', laneCenter[t] + 4)
        .attr('text-anchor', 'end')
        .attr('font-size', 11)
        .attr('font-weight', 600)
        .attr('fill', 'var(--color-text-muted)')
        .text(LANE_LABEL[t]);
    });
    for (let i = 1; i < LANE_ORDER.length; i++) {
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', MARGIN.top + laneH * i).attr('y2', MARGIN.top + laneH * i)
        .attr('stroke', 'var(--color-border)').attr('stroke-dasharray', '2,3');
    }

    const axisG = g.append('g').attr('transform', `translate(0,${H - MARGIN.bottom})`);
    const arcLayer = g.append('g').attr('fill', 'none');
    const nodeLayer = g.append('g');

    let currentXScale = xScale;
    let selected: { id: string; type: TimelineType } | null = null;

    function arcPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
      const link = d3.linkVertical<unknown, [number, number]>()
        .x(d => d[0]).y(d => d[1]);
      return link({ source: [a.x, a.y], target: [b.x, b.y] } as never) ?? '';
    }

    function computeX(year: number): number {
      return currentXScale(year);
    }

    function renderArcsForSelection() {
      if (!selected) {
        arcLayer.selectAll('*').remove();
        return;
      }
      let connections: { caseId: string; legislationId: string }[] = [];
      if (selected.type === 'legislation') {
        connections = edgesInView.filter(e => e.legislationId === selected!.id);
      } else if (selected.type === 'case') {
        connections = edgesInView.filter(e => e.caseId === selected!.id);
      }
      const paths = connections.map(e => {
        const legItem = itemById.get(e.legislationId);
        const caseItem = itemById.get(e.caseId);
        if (!legItem || !caseItem) return null;
        return {
          key: `${e.caseId}_${e.legislationId}`,
          colour: caseItem.register ? registerColours[caseItem.register] : 'var(--color-text-muted)',
          a: { x: computeX(legItem.year), y: legItem.laneY },
          b: { x: computeX(caseItem.year), y: caseItem.laneY },
        };
      }).filter((x): x is NonNullable<typeof x> => x !== null);

      arcLayer.selectAll<SVGPathElement, typeof paths[number]>('path')
        .data(paths, d => d.key)
        .join('path')
        .attr('d', d => arcPath(d.a, d.b))
        .attr('stroke', d => d.colour)
        .attr('stroke-width', 1.4)
        .attr('stroke-opacity', 0.75);
    }

    function selectionAdjacentIds(): Set<string> | null {
      if (!selected) return null;
      const adj = new Set<string>([selected.id]);
      edgesInView.forEach(e => {
        if (selected!.type === 'legislation' && e.legislationId === selected!.id) adj.add(e.caseId);
        if (selected!.type === 'case' && e.caseId === selected!.id) adj.add(e.legislationId);
      });
      return adj;
    }

    function buildSelection(id: string, type: TimelineType): TimelineSelection | null {
      const item = itemById.get(id);
      if (!item) return null;
      if (type === 'legislation') {
        const linkedEdges = edgesInView.filter(e => e.legislationId === id);
        const linked = linkedEdges
          .map(e => cases.find(c => c.id === e.caseId))
          .filter((c): c is TimelineCaseItem => !!c)
          .map(c => ({ id: c.id, label: c.label, year: c.year, url: c.url }));
        const yearCounts = new Map<number, number>();
        linkedEdges.forEach(e => {
          const c = cases.find(cc => cc.id === e.caseId);
          if (c) yearCounts.set(c.year, (yearCounts.get(c.year) ?? 0) + 1);
        });
        return {
          type, id, label: item.label, year: item.year,
          sub: `Legislation · ${linkedEdges.length} linked case${linkedEdges.length === 1 ? '' : 's'}`,
          linked,
          yearCounts: [...yearCounts.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })),
        };
      }
      if (type === 'case') {
        const linkedEdges = edgesInView.filter(e => e.caseId === id);
        const linked = linkedEdges
          .map(e => legislation.find(l => l.id === e.legislationId))
          .filter((l): l is TimelineLegislationItem => !!l)
          .map(l => ({ id: l.id, label: l.label, year: l.year }));
        return { type, id, label: item.label, year: item.year, sub: 'Case', linked };
      }
      return { type, id, label: item.label, year: item.year, sub: 'Incident', linked: [] };
    }

    function selectItem(id: string | null, type?: TimelineType) {
      selected = id && type ? { id, type } : null;
      onSelectRef.current(id && type ? buildSelection(id, type) : null);
      renderArcsForSelection();
      updateHighlight();
    }

    function updateHighlight() {
      const adj = selectionAdjacentIds();
      nodeLayer.selectAll<SVGCircleElement, PosItem>('circle')
        .attr('opacity', d => (!adj ? 1 : adj.has(d.id) ? 1 : 0.15));
    }

    svg.on('click', () => selectItem(null));

    const tip = d3.select('body').append('div').attr('class', 'ng-overlay ng-tooltip');
    function showTip(clientX: number, clientY: number, d: PosItem) {
      tip.style('display', 'block').html(
        `<div class="ng-tip-title">${escapeHtml(d.label)}</div>` +
        `<div class="ng-tip-sub">${d.year}${d.type === 'legislation' ? ` · ${d.degree} case${d.degree === 1 ? '' : 's'}` : ''}</div>`
      );
      tip.style('left', clientX + 14 + 'px').style('top', clientY - 10 + 'px');
    }

    function nodeColour(d: PosItem): string {
      if (d.type === 'case' && d.register) return registerColours[d.register];
      return typeColours[d.type];
    }
    function nodeRadius(d: PosItem): number {
      if (d.type === 'legislation') return legRadius(d.degree);
      if (d.type === 'incident') return 5;
      return 3;
    }

    const nodeSel = nodeLayer.selectAll<SVGCircleElement, PosItem>('circle')
      .data(items, d => d.id)
      .join('circle')
      .attr('r', nodeRadius)
      .attr('fill', nodeColour)
      .attr('fill-opacity', d => (d.type === 'case' ? 0.55 : 0.9))
      .attr('stroke', '#fff')
      .attr('stroke-width', d => (d.type === 'case' ? 0.5 : 1))
      .style('cursor', 'pointer')
      .style('pointer-events', 'all');

    nodeSel
      .on('click', (e, d) => { e.stopPropagation(); selectItem(selected?.id === d.id ? null : d.id, d.type); })
      .on('mouseover', (e, d) => showTip(e.clientX, e.clientY, d))
      .on('mousemove', (e, d) => showTip(e.clientX, e.clientY, d))
      .on('mouseout', () => tip.style('display', 'none'));

    function render() {
      nodeSel.attr('cx', d => computeX(d.year)).attr('cy', d => d.laneY);
      axisG.call(d3.axisBottom(currentXScale).ticks(Math.min(innerW / 70, 20)).tickFormat(d3.format('d')));
      renderArcsForSelection();
    }

    const zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 30])
      .translateExtent([[0, 0], [innerW, H]])
      .extent([[0, 0], [innerW, H]])
      .on('zoom', e => {
        currentXScale = e.transform.rescaleX(xScale);
        render();
      });
    svg.call(zoomBehaviour).call(zoomBehaviour.transform, d3.zoomIdentity);

    if (cmdRef) {
      cmdRef.current = {
        resetZoom: () => svg.transition().duration(300).call(zoomBehaviour.transform, d3.zoomIdentity),
      };
    }

    render();

    return () => {
      svg.on('.zoom', null);
      tip.remove();
      d3.select(container).selectAll('.ng-overlay').remove();
    };
  }, [legislation, incidents, cases, edges, minYear, maxYear, height, typeColours, registerColours, cmdRef]);

  return (
    <div ref={containerRef} className="ng-container" style={{ position: 'relative', height }}>
      <svg ref={svgRef} className="analytics-graph-svg" />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
