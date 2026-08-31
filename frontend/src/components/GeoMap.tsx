import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import auStatesRaw from '../data/au_states.json';

const auStates = auStatesRaw as unknown as FeatureCollection<Polygon | MultiPolygon, { STATE_NAME: string }>;

export type GeoRegister = 'protest' | 'political_violence';

export interface GeoCase {
  id: string;
  caseName: string;
  year: number;
  register: GeoRegister;
  jurisdictionDisplay: string | null;
  url: string | null;
}

export interface GeoStateSelection {
  stateName: string;
  counts: Record<GeoRegister, number>;
  cases: GeoCase[];
}

interface GeoMapProps {
  cases: GeoCase[];
  height?: number;
  registerColours: Record<GeoRegister, string>;
  onSelectState: (sel: GeoStateSelection | null) => void;
}

// The bundled GeoJSON uses full state names; the case register's
// jurisdiction_display field mostly matches already, except these two.
const STATE_ALIASES: Record<string, string> = {
  NSW: 'New South Wales',
  ACT: 'Australian Capital Territory',
};

// Segments that don't identify a state at all (federal-only reach, or the
// jurisdiction simply wasn't determined) — these can't be plotted.
const UNMAPPABLE_SEGMENTS = new Set(['Commonwealth', 'Not identified']);

const REGISTERS: GeoRegister[] = ['protest', 'political_violence'];

interface StateAgg {
  feature: Feature<Polygon | MultiPolygon, { STATE_NAME: string }>;
  counts: Record<GeoRegister, number>;
  cases: GeoCase[];
}

export function joinCasesToStates(cases: GeoCase[]): { byState: Map<string, StateAgg>; excluded: number } {
  const byState = new Map<string, StateAgg>();
  auStates.features.forEach(f => {
    byState.set(f.properties.STATE_NAME, { feature: f, counts: { protest: 0, political_violence: 0 }, cases: [] });
  });

  let excluded = 0;
  for (const c of cases) {
    const segments = (c.jurisdictionDisplay ?? '').split('/').map(s => s.trim()).filter(Boolean);
    const stateNames = new Set(
      segments
        .filter(s => !UNMAPPABLE_SEGMENTS.has(s))
        .map(s => STATE_ALIASES[s] ?? s)
        .filter(s => byState.has(s))
    );
    if (stateNames.size === 0) {
      excluded++;
      continue;
    }
    stateNames.forEach(name => {
      const entry = byState.get(name)!;
      entry.counts[c.register]++;
      entry.cases.push(c);
    });
  }
  return { byState, excluded };
}

export default function GeoMap({ cases, height = 620, registerColours, onSelectState }: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onSelectRef = useRef(onSelectState);
  useEffect(() => { onSelectRef.current = onSelectState; }, [onSelectState]);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl) return;

    const W = container.clientWidth || 900;
    const H = height;

    const { byState } = joinCasesToStates(cases);
    const maxCount = Math.max(1, ...[...byState.values()].flatMap(s => REGISTERS.map(r => s.counts[r])));
    const rScale = d3.scaleSqrt().domain([0, maxCount]).range([0, 34]);

    d3.select(container).selectAll('.ng-overlay').remove();

    const svg = d3.select(svgEl).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent');

    const g = svg.append('g');

    const zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 10])
      .on('zoom', e => g.attr('transform', e.transform.toString()));
    svg.call(zoomBehaviour);

    const projection = d3.geoMercator().fitExtent([[24, 24], [W - 24, H - 24]], auStates);
    const path = d3.geoPath(projection);

    let selectedState: string | null = null;

    const stateSel = g.append('g').selectAll('path')
      .data(auStates.features)
      .join('path')
      .attr('d', path)
      .attr('fill', 'var(--color-background-warm)')
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer');

    const bubbleLayer = g.append('g');

    function updateSelectionStyle() {
      stateSel.attr('stroke', d => (d.properties.STATE_NAME === selectedState ? 'var(--color-accent)' : 'var(--color-border)'))
        .attr('stroke-width', d => (d.properties.STATE_NAME === selectedState ? 2 : 1));
    }

    function selectState(name: string | null) {
      selectedState = name;
      updateSelectionStyle();
      if (!name) { onSelectRef.current(null); return; }
      const entry = byState.get(name);
      if (!entry) { onSelectRef.current(null); return; }
      onSelectRef.current({ stateName: name, counts: entry.counts, cases: entry.cases });
    }

    stateSel.on('click', (e, d) => {
      e.stopPropagation();
      const name = d.properties.STATE_NAME;
      selectState(selectedState === name ? null : name);
    });
    svg.on('click.desel', () => selectState(null));

    const tip = d3.select('body').append('div').attr('class', 'ng-overlay ng-tooltip');
    function showTip(clientX: number, clientY: number, name: string, counts: Record<GeoRegister, number>) {
      tip.style('display', 'block').html(
        `<div class="ng-tip-title">${escapeHtml(name)}</div>` +
        `<div class="ng-tip-sub">Protest cases: ${counts.protest}</div>` +
        `<div class="ng-tip-sub">Political violence cases: ${counts.political_violence}</div>`
      );
      tip.style('left', clientX + 14 + 'px').style('top', clientY - 10 + 'px');
    }
    stateSel
      .on('mouseover', (e, d) => showTip(e.clientX, e.clientY, d.properties.STATE_NAME, byState.get(d.properties.STATE_NAME)!.counts))
      .on('mousemove', (e, d) => showTip(e.clientX, e.clientY, d.properties.STATE_NAME, byState.get(d.properties.STATE_NAME)!.counts))
      .on('mouseout', () => tip.style('display', 'none'));

    auStates.features.forEach(f => {
      const [cx, cy] = path.centroid(f);
      if (Number.isNaN(cx) || Number.isNaN(cy)) return;
      const entry = byState.get(f.properties.STATE_NAME)!;
      const name = f.properties.STATE_NAME;

      REGISTERS.forEach((register, i) => {
        const r = rScale(entry.counts[register]);
        if (r <= 0) return;
        const offset = (i === 0 ? -1 : 1) * (r * 0.55 + 3);
        bubbleLayer.append('circle')
          .attr('cx', cx + offset)
          .attr('cy', cy)
          .attr('r', r)
          .attr('fill', registerColours[register])
          .attr('fill-opacity', 0.72)
          .attr('stroke', registerColours[register])
          .attr('stroke-width', 1)
          .style('cursor', 'pointer')
          .style('pointer-events', 'all')
          .on('click', e => { e.stopPropagation(); selectState(selectedState === name ? null : name); })
          .on('mouseover', e => showTip(e.clientX, e.clientY, name, entry.counts))
          .on('mousemove', e => showTip(e.clientX, e.clientY, name, entry.counts))
          .on('mouseout', () => tip.style('display', 'none'));
      });
    });

    return () => {
      svg.on('click.desel', null);
      tip.remove();
      d3.select(container).selectAll('.ng-overlay').remove();
    };
  }, [cases, height, registerColours]);

  return (
    <div ref={containerRef} className="ng-container" style={{ position: 'relative', height }}>
      <svg ref={svgRef} className="analytics-graph-svg" />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
