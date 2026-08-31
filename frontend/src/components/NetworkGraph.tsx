import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

// How settled the simulation needs to be before the camera is allowed to
// move to it (a fit-on-load or a cross-page focus jump). Waiting for the
// simulation's true 'end' (alpha below ~0.001) takes several seconds on a
// graph this size; the layout already reads as settled well before that,
// so triggering off a much higher alpha cuts the wait dramatically.
const SETTLE_ALPHA = 0.15;

export type NetworkNodeType = 'legislation' | 'incident' | 'case' | 'source';
export type LayoutAlgo = 'clustered' | 'force' | 'circular';
export type SizeMode = 'degree' | 'uniform';

export interface NetworkNode {
  id: string;
  type: NetworkNodeType;
  label: string;
  sub: string;
  year: number | null;
  url?: string;
  colour: string;
}

export interface NetworkEdge {
  from: string;
  to: string;
  colour: string;
}

export interface NetworkGraphHandle {
  focusNode: (id: string) => void;
  focusEdge: (aId: string, bId: string) => void;
  fitView: () => void;
  clearSelection: () => void;
}

type SimNode = NetworkNode & d3.SimulationNodeDatum;
type SimLink = { source: SimNode | string; target: SimNode | string; colour: string };

const TYPE_CENTER: Record<NetworkNodeType, [number, number]> = {
  legislation: [0.22, 0.3],
  incident: [0.78, 0.28],
  source: [0.78, 0.64],
  case: [0.5, 0.85],
};

// Contiguous ring order for the circular layout — sources sit next to the
// incidents they're drawn from.
const CIRCULAR_ORDER: NetworkNodeType[] = ['legislation', 'incident', 'source', 'case'];

// All settings controls live off-canvas (Analytics.tsx renders them above
// the graph, not overlaid on it), so there's no chrome to keep clear of —
// these stay at 0 rather than removing the safe-area math outright, in case
// on-canvas chrome (e.g. the Pan/Select area/Fit view toolbar growing) ever
// needs it reinstated.
export const TOP_RESERVE = 0;
export const RIGHT_RESERVE = 0;

interface NetworkGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  height?: number;
  layout: LayoutAlgo;
  sizeMode: SizeMode;
  repulsion: number;
  cmdRef: React.MutableRefObject<NetworkGraphHandle | null>;
  onSelectNode: (id: string | null) => void;
  onNodeContextMenu: (id: string, clientX: number, clientY: number) => void;
}

export default function NetworkGraph({
  nodes, edges, height = 620, layout, sizeMode, repulsion, cmdRef, onSelectNode, onNodeContextMenu,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onSelectRef = useRef(onSelectNode);
  const onCtxRef = useRef(onNodeContextMenu);
  const [settling, setSettling] = useState(true);
  useEffect(() => { onSelectRef.current = onSelectNode; }, [onSelectNode]);
  useEffect(() => { onCtxRef.current = onNodeContextMenu; }, [onNodeContextMenu]);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl) return;

    setSettling(true);

    const W = container.clientWidth || 900;
    const H = height;
    // Visible area not covered by the settings overlays — clusters, the
    // circular ring, and fit/focus framing all target this sub-rectangle
    // rather than the full canvas.
    const safeW = Math.max(200, W - RIGHT_RESERVE);
    const safeH = Math.max(200, H - TOP_RESERVE);
    const safeCX = safeW / 2;
    const safeCY = TOP_RESERVE + safeH / 2;

    d3.select(container).selectAll('.ng-overlay').remove();

    const svg = d3.select(svgEl).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();
    svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'transparent');

    const g = svg.append('g');
    let currentTransform = d3.zoomIdentity;

    const zoomBehaviour = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 8])
      .on('zoom', e => {
        currentTransform = e.transform;
        g.attr('transform', e.transform.toString());
      });
    svg.call(zoomBehaviour);

    const nodeData: SimNode[] = nodes.map(n => ({ ...n }));
    const linkData: SimLink[] = edges.map(e => ({ source: e.from, target: e.to, colour: e.colour }));

    const degree = new Map<string, number>();
    linkData.forEach(l => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      degree.set(s, (degree.get(s) ?? 0) + 1);
      degree.set(t, (degree.get(t) ?? 0) + 1);
    });
    const maxDegree = d3.max(nodeData, d => degree.get(d.id) ?? 0) || 1;
    const rScale = d3.scaleSqrt().domain([0, maxDegree]).range([4, 13]);
    const radius = (d: SimNode) => (sizeMode === 'uniform' ? 6 : rScale(degree.get(d.id) ?? 0));

    const sim = d3.forceSimulation(nodeData);

    if (layout === 'circular') {
      const sorted = [...nodeData].sort((a, b) => CIRCULAR_ORDER.indexOf(a.type) - CIRCULAR_ORDER.indexOf(b.type));
      const R = Math.min(safeW, safeH) / 2 - 40;
      sorted.forEach((n, i) => {
        const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
        n.x = safeCX + R * Math.cos(angle);
        n.y = safeCY + R * Math.sin(angle);
      });
      sim
        .force('collide', d3.forceCollide<SimNode>().radius(d => radius(d) + 2).strength(0.9))
        .alpha(0.4)
        .alphaDecay(0.08);
    } else {
      sim
        .force('link', d3.forceLink<SimNode, SimLink>(linkData).id(d => d.id).distance(26).strength(0.35))
        .force('charge', d3.forceManyBody().strength(d => -Math.max(30, radius(d as SimNode) * 9) * repulsion))
        .force('collide', d3.forceCollide<SimNode>().radius(d => radius(d) + 2).strength(0.8))
        .alphaDecay(0.02);
      if (layout === 'clustered') {
        sim
          .force('x', d3.forceX<SimNode>(d => TYPE_CENTER[d.type][0] * safeW).strength(0.06))
          .force('y', d3.forceY<SimNode>(d => TOP_RESERVE + TYPE_CENTER[d.type][1] * safeH).strength(0.06));
      } else {
        sim
          .force('x', d3.forceX<SimNode>(safeCX).strength(0.02))
          .force('y', d3.forceY<SimNode>(safeCY).strength(0.02));
      }
    }

    let selectedIds = new Set<string>();
    let focusedThisRun = false;
    let pendingFocusIds: string[] | null = null;
    let settledOnce = false;

    function onSettled() {
      if (settledOnce) return;
      settledOnce = true;
      setSettling(false);
      if (pendingFocusIds) {
        focusedThisRun = true;
        moveCameraTo(pendingFocusIds, 500);
        pendingFocusIds = null;
      } else if (!focusedThisRun) {
        doFit(500);
      }
    }

    function updateHighlight() {
      if (selectedIds.size === 0) {
        nodeSel.attr('opacity', 1).attr('stroke-width', 1.25);
        edgeSel.attr('stroke-opacity', 0.35);
        return;
      }
      const adj = new Set(selectedIds);
      linkData.forEach(l => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        if (selectedIds.has(s)) adj.add(t);
        if (selectedIds.has(t)) adj.add(s);
      });
      nodeSel
        .attr('opacity', d => (selectedIds.has(d.id) ? 1 : adj.has(d.id) ? 0.55 : 0.08))
        .attr('stroke-width', d => (selectedIds.has(d.id) ? 2.5 : 1.25));
      edgeSel.attr('stroke-opacity', l => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        return selectedIds.has(s) || selectedIds.has(t) ? 0.9 : 0.03;
      });
    }

    function setSelection(ids: Set<string>) {
      selectedIds = ids;
      updateHighlight();
      if (ids.size === 1) onSelectRef.current?.([...ids][0]);
      else onSelectRef.current?.(null);
    }

    function doFit(ms = 600) {
      if (!nodeData.length) return;
      const xs = nodeData.map(n => n.x ?? 0), ys = nodeData.map(n => n.y ?? 0);
      const x0 = Math.min(...xs) - 24, x1 = Math.max(...xs) + 24;
      const y0 = Math.min(...ys) - 24, y1 = Math.max(...ys) + 24;
      const scale = Math.min((safeW - 40) / (x1 - x0 || 1), (safeH - 40) / (y1 - y0 || 1), 2.5);
      const tx = safeCX - ((x0 + x1) / 2) * scale;
      const ty = safeCY - ((y0 + y1) / 2) * scale;
      svg.transition().duration(ms).call(zoomBehaviour.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    function moveCameraTo(ids: string[], ms = 650) {
      const found = nodeData.filter(n => ids.includes(n.id));
      if (found.length === 0) return;
      const xs = found.map(n => n.x ?? 0), ys = found.map(n => n.y ?? 0);
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
      const scale = 1.7;
      const tx = safeCX - cx * scale;
      const ty = safeCY - cy * scale;
      svg.transition().duration(ms).call(zoomBehaviour.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    // Highlighting is instant, but the camera move must wait for the
    // simulation to actually settle near its final layout — jumping while
    // alpha is still high (e.g. right after a fresh mount) lands on the
    // initial seed position, not where the node ends up.
    function focusOnIds(ids: string[]) {
      setSelection(new Set(ids));
      if (!settledOnce) {
        pendingFocusIds = ids;
      } else {
        focusedThisRun = true;
        moveCameraTo(ids);
      }
    }

    cmdRef.current = {
      focusNode(id) {
        focusOnIds([id]);
      },
      focusEdge(a, b) {
        focusOnIds([a, b]);
      },
      fitView: () => doFit(500),
      clearSelection: () => setSelection(new Set()),
    };

    // ── Edges ──
    const edgeSel = g.append('g').selectAll<SVGLineElement, SimLink>('line').data(linkData).join('line')
      .attr('stroke', d => d.colour)
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', 1.1);

    // ── Nodes ──
    const drag = d3.drag<SVGCircleElement, SimNode>()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });

    const nodeSel = g.append('g').selectAll<SVGCircleElement, SimNode>('circle').data(nodeData).join('circle')
      .attr('r', radius)
      .attr('fill', d => d.colour)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.25)
      .style('cursor', 'pointer')
      .call(drag);

    nodeSel.on('click', (e, d) => {
      e.stopPropagation();
      setSelection(selectedIds.has(d.id) && selectedIds.size === 1 ? new Set() : new Set([d.id]));
    });
    svg.on('click.desel', () => setSelection(new Set()));

    nodeSel.on('contextmenu', (e, d) => {
      e.preventDefault();
      onCtxRef.current?.(d.id, e.clientX, e.clientY);
    });

    // ── Tooltip ──
    const tip = d3.select('body').append('div').attr('class', 'ng-overlay ng-tooltip');
    nodeSel
      .on('mouseover', (_e, d) => {
        tip.style('display', 'block').html(
          `<div class="ng-tip-title">${escapeHtml(d.label)}</div>` +
          `<div class="ng-tip-sub">${escapeHtml(d.sub)}</div>` +
          (d.year !== null ? `<div class="ng-tip-sub">${d.year}</div>` : '')
        );
      })
      .on('mousemove', e => tip.style('left', e.clientX + 14 + 'px').style('top', e.clientY - 10 + 'px'))
      .on('mouseout', () => tip.style('display', 'none'));

    // ── Toolbar ──
    const toolbar = d3.select(container).append('div').attr('class', 'ng-overlay ng-toolbar');
    const panBtn = toolbar.append('button').attr('class', 'ng-toolbar-btn ng-toolbar-btn-active').text('Pan');
    const selBtn = toolbar.append('button').attr('class', 'ng-toolbar-btn').text('Select area');
    const fitBtn = toolbar.append('button').attr('class', 'ng-toolbar-btn').text('Fit view');

    const brushG = svg.append('g').attr('class', 'ng-brush').style('display', 'none');
    const brush = d3.brush().extent([[0, 0], [W, H]])
      .on('end', e => {
        if (!e.selection) return;
        const [[bx0, by0], [bx1, by1]] = e.selection as [[number, number], [number, number]];
        const brushed = new Set(
          nodeData
            .filter(n => {
              const sx = currentTransform.applyX(n.x ?? 0), sy = currentTransform.applyY(n.y ?? 0);
              return sx >= bx0 && sx <= bx1 && sy >= by0 && sy <= by1;
            })
            .map(n => n.id)
        );
        if (brushed.size > 0) {
          selectedIds = brushed;
          updateHighlight();
          onSelectRef.current?.(null);
        }
        brushG.call(brush.clear);
      });

    panBtn.on('click', () => {
      panBtn.classed('ng-toolbar-btn-active', true);
      selBtn.classed('ng-toolbar-btn-active', false);
      brushG.style('display', 'none').on('.brush', null);
      svg.call(zoomBehaviour);
    });
    selBtn.on('click', () => {
      selBtn.classed('ng-toolbar-btn-active', true);
      panBtn.classed('ng-toolbar-btn-active', false);
      svg.on('.zoom', null);
      brushG.style('display', 'block').call(brush);
    });
    fitBtn.on('click', () => doFit());

    sim.on('tick', () => {
      edgeSel
        .attr('x1', d => (typeof d.source === 'string' ? 0 : d.source.x ?? 0))
        .attr('y1', d => (typeof d.source === 'string' ? 0 : d.source.y ?? 0))
        .attr('x2', d => (typeof d.target === 'string' ? 0 : d.target.x ?? 0))
        .attr('y2', d => (typeof d.target === 'string' ? 0 : d.target.y ?? 0));
      nodeSel.attr('cx', d => d.x ?? 0).attr('cy', d => d.y ?? 0);
      if (!settledOnce && sim.alpha() < SETTLE_ALPHA) onSettled();
    });

    sim.on('end', onSettled);

    return () => {
      sim.stop();
      tip.remove();
      d3.select(container).selectAll('.ng-overlay').remove();
    };
  }, [nodes, edges, height, layout, sizeMode, repulsion, cmdRef]);

  return (
    <div ref={containerRef} className="ng-container" style={{ position: 'relative', height }}>
      <svg ref={svgRef} style={{ width: '100%', display: 'block' }} />
      {settling && (
        <div className="ng-settling">
          <span className="ng-settling-spinner" />
          Arranging network…
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
