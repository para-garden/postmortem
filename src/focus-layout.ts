/**
 * Force-directed layout around the focused node.
 * Runs the simulation synchronously to convergence, then applies the
 * result via a CSS transition so the movement is smooth.
 */
import type { Graph, Node } from "./graph";
import { updatePositions, nodeEls, worldEl } from "./dom";
import { getSettings } from "./settings";
import { isNodeCwHidden } from "./content-gate";

const REPEL = 4000;
const SPRING_K = 0.018;
const SPRING_LEN = 80;
const ANCHOR_K = 0.008;
const FOCUS_GRAVITY = 0.015;
const DAMPING = 0.86;
const MAX_FORCE = 8;
const SETTLE_THRESHOLD = 0.3;
const NEIGHBORHOOD_HOPS = 2;
const MAX_ITERS = 400;
/** Duration of the CSS settle transition in ms. */
const SETTLE_DURATION = 300;

function nodeRadius(n: Node): number {
  return n.collisionRadius ?? n.radius;
}

export function createFocusLayout(graph: Graph) {
  let focusedId: string | null = null;
  let neighborIds = new Set<string>();
  const vx = new Map<string, number>();
  const vy = new Map<string, number>();
  const anchorX = new Map<string, number>();
  const anchorY = new Map<string, number>();
  // Positions captured at the start of a focus session; restored on unfocus.
  const preFocusX = new Map<string, number>();
  const preFocusY = new Map<string, number>();
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  let settleTimer = 0;

  function getNeighborhood(nodeId: string, hops: number): Set<string> {
    const result = new Set<string>([nodeId]);
    let frontier = new Set([nodeId]);
    for (let h = 0; h < hops; h++) {
      const next = new Set<string>();
      for (const id of frontier) {
        for (const edge of graph.edges) {
          const other =
            edge.from === id ? edge.to : edge.to === id ? edge.from : null;
          if (other && !result.has(other)) {
            result.add(other);
            next.add(other);
          }
        }
      }
      frontier = next;
    }
    return result;
  }

  function applySettled(): void {
    clearTimeout(settleTimer);
    worldEl.dataset.settling = "";
    updatePositions(graph);
    settleTimer = setTimeout(() => {
      delete worldEl.dataset.settling;
    }, SETTLE_DURATION + 50) as unknown as number;
  }

  function simulate(active: Node[], edges: typeof graph.edges): void {
    for (let iter = 0; iter < MAX_ITERS; iter++) {
      let maxV = 0;

      // Repulsion
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const a = active[i]!, b = active[j]!;
          const minDist = nodeRadius(a) + nodeRadius(b) + 4;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const d = Math.sqrt(d2) || 1;
          const f = Math.min(d < minDist ? REPEL * 4 / d2 : REPEL / d2, MAX_FORCE);
          const fx = (dx / d) * f, fy = (dy / d) * f;
          if (a.id !== focusedId) { vx.set(a.id, vx.get(a.id)! - fx); vy.set(a.id, vy.get(a.id)! - fy); }
          if (b.id !== focusedId) { vx.set(b.id, vx.get(b.id)! + fx); vy.set(b.id, vy.get(b.id)! + fy); }
        }
      }

      // Spring attraction along edges
      for (const edge of edges) {
        const a = nodeMap.get(edge.from), b = nodeMap.get(edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - SPRING_LEN) * SPRING_K * edge.strength;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        if (a.id !== focusedId) { vx.set(a.id, vx.get(a.id)! + fx); vy.set(a.id, vy.get(a.id)! + fy); }
        if (b.id !== focusedId) { vx.set(b.id, vx.get(b.id)! - fx); vy.set(b.id, vy.get(b.id)! - fy); }
      }

      // Gravity toward focused node
      const fNode = nodeMap.get(focusedId!)!;
      for (const n of active) {
        if (n.id === focusedId) continue;
        vx.set(n.id, vx.get(n.id)! + (fNode.x - n.x) * FOCUS_GRAVITY);
        vy.set(n.id, vy.get(n.id)! + (fNode.y - n.y) * FOCUS_GRAVITY);
      }

      // Anchor toward pre-focus positions
      for (const n of active) {
        if (n.id === focusedId) continue;
        vx.set(n.id, vx.get(n.id)! + (anchorX.get(n.id)! - n.x) * ANCHOR_K);
        vy.set(n.id, vy.get(n.id)! + (anchorY.get(n.id)! - n.y) * ANCHOR_K);
      }

      // Apply velocities with damping
      for (const n of active) {
        if (n.id === focusedId) continue;
        const nvx = vx.get(n.id)! * DAMPING;
        const nvy = vy.get(n.id)! * DAMPING;
        vx.set(n.id, nvx);
        vy.set(n.id, nvy);
        n.x += nvx;
        n.y += nvy;
        maxV = Math.max(maxV, Math.abs(nvx), Math.abs(nvy));
      }

      if (maxV < SETTLE_THRESHOLD) break;
    }
  }

  function onFocusChange(node: Node | null): void {
    const settings = getSettings();
    const newId = node?.id ?? null;
    if (newId === focusedId) return;

    // Capture pre-focus positions at the start of a session (null → something).
    // On unfocus we restore these instead of baseX/baseY, so filter/CW layouts
    // aren't destroyed by the focus sim.
    if (focusedId === null && newId !== null && settings.dynamicLayout) {
      for (const n of graph.nodes) { preFocusX.set(n.id, n.x); preFocusY.set(n.id, n.y); }
    }

    focusedId = newId;

    if (!focusedId) {
      clearNeighborhoodAttr();
      if (settings.dynamicLayout) {
        for (const n of graph.nodes) {
          n.x = preFocusX.get(n.id) ?? n.baseX;
          n.y = preFocusY.get(n.id) ?? n.baseY;
        }
        applySettled();
      }
      return;
    }

    neighborIds = getNeighborhood(focusedId, NEIGHBORHOOD_HOPS);
    applyNeighborhoodAttr();

    if (!settings.dynamicLayout) return;

    // Initialize velocities and anchors from current positions
    vx.clear(); vy.clear();
    anchorX.clear(); anchorY.clear();
    for (const n of graph.nodes) {
      vx.set(n.id, 0);
      vy.set(n.id, 0);
      anchorX.set(n.id, n.x);
      anchorY.set(n.id, n.y);
    }

    const active = graph.nodes.filter(
      (n) => neighborIds.has(n.id) && !n.tags.includes("meta") && !isNodeCwHidden(n),
    );
    const edges = graph.edges.filter(
      (e) => neighborIds.has(e.from) && neighborIds.has(e.to),
    );

    simulate(active, edges);
    applySettled();
  }

  function applyNeighborhoodAttr(): void {
    if (!getSettings().neighborhoodFocus) return;
    for (const [id, el] of nodeEls) {
      const node = nodeMap.get(id);
      if (node && isNodeCwHidden(node)) { delete el.dataset.neighborhood; continue; }
      if (neighborIds.has(id)) {
        delete el.dataset.neighborhood;
      } else {
        el.dataset.neighborhood = "distant";
      }
    }
  }

  function clearNeighborhoodAttr(): void {
    for (const [, el] of nodeEls) {
      delete el.dataset.neighborhood;
    }
  }

  return {
    onFocusChange,
    getNeighborIds: () => neighborIds,
  };
}
