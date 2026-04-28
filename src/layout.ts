import type { Graph, Node } from "./graph";

/**
 * Effective collision radius: base radius + estimated text height below the circle.
 * Descriptions are split at sentence boundaries (same logic as descLines in dom.ts)
 * and rendered at 11px * 0.65 scale ≈ 7px per line in world space.
 */
function effectiveRadius(n: Node): number {
  const base = n.collisionRadius ?? n.radius;
  if (!n.description) return base;
  const lines = n.description.replace(/([.!?])\s+/g, "$1\n").split("\n").filter(Boolean).length;
  return base + lines * 7;
}

/**
 * Run a synchronous force-directed simulation on visible non-meta nodes.
 * Mutates node.x / node.y in place.
 */
export function runLayout(
  graph: Graph,
  visibleIds: Set<string>,
  options?: { totalEligible?: number; force?: boolean },
): void {
  const nodes = graph.nodes.filter(
    (n) => visibleIds.has(n.id) && !n.tags.includes("meta"),
  );
  if (nodes.length === 0) return;

  const { totalEligible, force } = options ?? {};

  // Fade layout effect to zero as visible count approaches half of eligible nodes.
  // force=true bypasses the threshold (used when CW nodes are hidden — we always want full layout).
  const totalNonEco = totalEligible ?? graph.nodes.filter((n) => !n.tags.includes("meta")).length;
  const THRESHOLD = 0.45;
  const ratio = nodes.length / totalNonEco;
  const weight = force ? 1 : Math.max(0, (THRESHOLD - ratio) / THRESHOLD);
  if (weight === 0) return;

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const edges = graph.edges.filter(
    (e) => visibleIds.has(e.from) && visibleIds.has(e.to),
  );

  // Capture current positions as anchors (= current grouping positions, not build-time baseX/baseY)
  const anchorX = new Map<string, number>(nodes.map((n) => [n.id, n.x]));
  const anchorY = new Map<string, number>(nodes.map((n) => [n.id, n.y]));

  const vx = new Map<string, number>();
  const vy = new Map<string, number>();
  for (const n of nodes) {
    vx.set(n.id, 0);
    vy.set(n.id, 0);
  }

  const REPEL = 5000;
  const SPRING_K = 0.008;
  const SPRING_LEN = 120;
  // When force=true (CW-driven layout), anchoring nodes to their pre-sim positions
  // locks them in the gap left by hidden nodes. Zero the anchor so they rearrange freely;
  // use stronger centering to prevent drift.
  const ANCHOR_K = force ? 0 : 0.08;
  const CENTER_K = 0.006;
  const DAMPING = 0.85;
  const MAX_FORCE = 10;
  const MAX_STEPS = 200;

  for (let step = 0; step < MAX_STEPS; step++) {
    // Repulsion between all visible non-region pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2) || 1;
        const minDist = effectiveRadius(a) + effectiveRadius(b) + 8;
        const f = Math.min(d < minDist ? REPEL * 4 / d2 : REPEL / d2, MAX_FORCE);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        vx.set(a.id, vx.get(a.id)! - fx);
        vy.set(a.id, vy.get(a.id)! - fy);
        vx.set(b.id, vx.get(b.id)! + fx);
        vy.set(b.id, vy.get(b.id)! + fy);
      }
    }

    // Attraction along edges where both endpoints are visible
    for (const edge of edges) {
      const a = nodeMap.get(edge.from);
      const b = nodeMap.get(edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - SPRING_LEN) * SPRING_K;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;

      vx.set(a.id, vx.get(a.id)! + fx);
      vy.set(a.id, vy.get(a.id)! + fy);
      vx.set(b.id, vx.get(b.id)! - fx);
      vy.set(b.id, vy.get(b.id)! - fy);
    }

    // Gentle anchor toward pre-simulation positions (= current grouping positions)
    if (ANCHOR_K > 0) {
      for (const n of nodes) {
        const dx = anchorX.get(n.id)! - n.x;
        const dy = anchorY.get(n.id)! - n.y;
        vx.set(n.id, vx.get(n.id)! + dx * ANCHOR_K);
        vy.set(n.id, vy.get(n.id)! + dy * ANCHOR_K);
      }
    }

    // Centering: pull toward collective centroid (keeps disjoint groups together)
    let cx = 0;
    let cy = 0;
    for (const n of nodes) {
      cx += n.x;
      cy += n.y;
    }
    cx /= nodes.length;
    cy /= nodes.length;
    for (const n of nodes) {
      vx.set(n.id, vx.get(n.id)! + (cx - n.x) * CENTER_K);
      vy.set(n.id, vy.get(n.id)! + (cy - n.y) * CENTER_K);
    }

    // Apply velocities with damping
    let maxV = 0;
    for (const n of nodes) {
      const nvx = vx.get(n.id)! * DAMPING;
      const nvy = vy.get(n.id)! * DAMPING;
      vx.set(n.id, nvx);
      vy.set(n.id, nvy);
      n.x += nvx;
      n.y += nvy;
      maxV = Math.max(maxV, Math.abs(nvx), Math.abs(nvy));
    }

    if (maxV < 0.5) break;
  }

  // Blend toward pre-simulation positions: weight 1 = full layout, 0 = base
  if (weight < 1) {
    for (const n of nodes) {
      n.x = anchorX.get(n.id)! + (n.x - anchorX.get(n.id)!) * weight;
      n.y = anchorY.get(n.id)! + (n.y - anchorY.get(n.id)!) * weight;
    }
  }
}

/** Restore all nodes to their original positions. */
export function resetLayout(graph: Graph): void {
  for (const node of graph.nodes) {
    node.x = node.baseX;
    node.y = node.baseY;
  }
}
