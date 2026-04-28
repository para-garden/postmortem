import { createCamera } from "./camera";
import { createGraph } from "./graph";
import { buildWorld, updateTransform, setFilterRef, updatePositions, animateTo, worldEl } from "./dom";
import { setupInput } from "./input";
import { initPanel, openPanel } from "./panel";
import { showCard, hideCard, getCurrentCardNode, setCardToggleFilter, setCardIsTagActive, setCardGetTagColor } from "./card";
import { createFilter, buildFilterUI, applyFilter, getVisibleIds, setActive, updateFilterPillColors, addFilterPill, removeFilterPill } from "./filter";
import { isAcknowledged, acknowledge, revoke, getCwTags, showGate, isNodeCwHidden } from "./content-gate";
import { applyCwVisibility } from "./dom";
import { runLayout } from "./layout";
import { createFocusLayout } from "./focus-layout";
import { loadSettingsFromUrl } from "./settings";
import { createMinimap } from "./minimap";
import { initGroupingState, buildGroupingUI, restoreGroupingFromUrl, getTagColor, setOnGroupingChange, resetToCurrentGrouping } from "./grouping-state";
import { siteConfig, getActiveCollection, siteUrl } from "./site-config";
import { landingEl } from "./dom";

loadSettingsFromUrl();
import { getSettings } from "./settings";
const camera = createCamera();
const graph = createGraph();

// Center camera on the active collection's meta node
const collectionMeta = siteConfig.collections[getActiveCollection()];
const metaNode = graph.nodes.find((n) => n.id === collectionMeta.metaNodeId);
if (metaNode) { camera.x = metaNode.x; camera.y = metaNode.y; }

// Disable transitions during initial setup
worldEl.dataset.noTransition = "";

buildWorld(graph);
applyCwVisibility(graph);

// Initialize grouping state and restore from URL
initGroupingState(graph, camera);
restoreGroupingFromUrl();

const filter = createFilter(graph.nodes);
setFilterRef(filter);

function updateFilterUrl(): void {
  const params = new URLSearchParams(location.search);
  if (filter.active.size > 0) {
    params.set("filter", [...filter.active].sort().join(","));
  } else {
    params.delete("filter");
  }
  const qs = params.toString();
  history.replaceState(history.state, "", qs ? `?${qs}` : location.pathname);
}

// Restore filter state from URL before first render
const initFilterParam = new URLSearchParams(location.search).get("filter");
if (initFilterParam) {
  setActive(filter, initFilterParam.split(","));
}

applyFilter(filter, graph);
runFilterLayout();
updatePositions(graph);
buildGroupingUI(document.getElementById("grouping-bar")!);
buildFilterUI(document.getElementById("filter-bar")!, filter, () => {
  applyFilter(filter, graph);
  runFilterLayout();
  updatePositions(graph);
  hideCard();
  updateFilterUrl();
});

// Visible IDs for layout: excludes CW-hidden nodes so they don't exert forces.
function getLayoutIds(): Set<string> {
  const ids = getVisibleIds(filter, graph);
  for (const node of graph.nodes) {
    if (isNodeCwHidden(node)) ids.delete(node.id);
  }
  return ids;
}

// Non-meta nodes that aren't permanently CW-hidden — the denominator for layout threshold.
function eligibleCount(): number {
  return graph.nodes.filter(n => !n.tags.includes("meta") && !isNodeCwHidden(n)).length;
}

function runFilterLayout(): void {
  const visibleIds = getLayoutIds();
  const anyCwHidden = graph.nodes.some(n => !n.tags.includes("meta") && isNodeCwHidden(n));
  if (filter.active.size > 0 || anyCwHidden) {
    // Reset to base positions before the CW sim so nodes spread from a clean
    // layout rather than from their current (gapped/clustered) positions.
    if (anyCwHidden) resetToCurrentGrouping(graph);
    runLayout(graph, visibleIds, { totalEligible: eligibleCount(), force: anyCwHidden });
  } else {
    resetToCurrentGrouping(graph);
  }
}

function onCwLayoutChange(): void {
  runFilterLayout();
  // Enable translate transition (same pattern as focus-layout applySettled).
  worldEl.dataset.settling = "";
  updatePositions(graph);
  setTimeout(() => { delete worldEl.dataset.settling; }, 350);
}

// CW bar — collapsed by default, expands on click to show CW toggles.
{
  const cwBar = document.getElementById("cw-bar");
  const filterBar = document.getElementById("filter-bar")!;
  const gates = siteConfig.contentGates as Record<string, { label: string; description: string }>;
  const cwKeys = Object.keys(gates).filter(key => graph.nodes.some(n => n.tags.includes(key)));

  if (cwBar && cwKeys.length > 0) {
    function onFilterChange(): void {
      applyFilter(filter, graph);
      runFilterLayout();
      updatePositions(graph);
      updateFilterUrl();
    }

    const trigger = document.createElement("button");
    trigger.className = "cw-trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Content warnings");
    trigger.textContent = "⚠";
    cwBar.appendChild(trigger);

    const panel = document.createElement("div");
    panel.className = "cw-panel";
    panel.hidden = true;
    cwBar.appendChild(panel);

    trigger.addEventListener("click", () => {
      const expanded = panel.hidden;
      panel.hidden = !expanded;
      trigger.setAttribute("aria-expanded", String(expanded));
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!cwBar.contains(e.target as Node)) {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    for (const key of cwKeys) {
      const gate = gates[key]!;
      const btn = document.createElement("button");
      btn.className = "cw-toggle";
      btn.dataset.key = key;
      btn.setAttribute("aria-pressed", isAcknowledged(key) ? "true" : "false");
      btn.textContent = gate.label;
      if (isAcknowledged(key)) {
        btn.dataset.active = "";
        addFilterPill(filterBar, filter, key, onFilterChange);
      }

      btn.addEventListener("click", () => {
        if (isAcknowledged(key)) {
          revoke(key);
          delete btn.dataset.active;
          btn.setAttribute("aria-pressed", "false");
          removeFilterPill(filterBar, filter, key);
          applyCwVisibility(graph);
          applyFilter(filter, graph);
          onCwLayoutChange();
        } else {
          showGate(
            [{ key, label: gate.label, description: gate.description }],
            () => {
              acknowledge(key, false);
              btn.dataset.active = "";
              btn.setAttribute("aria-pressed", "true");
              addFilterPill(filterBar, filter, key, onFilterChange);
              applyCwVisibility(graph);
              applyFilter(filter, graph);
              onCwLayoutChange();
            },
            () => { /* user dismissed — no change */ },
          );
        }
      });

      panel.appendChild(btn);
    }
  }
}

// Card tag support: clicking a tag on the card toggles the filter and compensates camera.
setCardToggleFilter((tag: string) => {
  const cardNode = getCurrentCardNode();
  const preX = cardNode?.x ?? 0;
  const preY = cardNode?.y ?? 0;

  if (filter.active.has(tag)) filter.active.delete(tag); else filter.active.add(tag);
  applyFilter(filter, graph);
  runFilterLayout();
  updatePositions(graph);
  updateFilterUrl();
  syncFilterPills();

  if (cardNode) {
    const dx = cardNode.x - preX, dy = cardNode.y - preY;
    if (dx !== 0 || dy !== 0) animateTo(camera, camera.x + dx, camera.y + dy, camera.zoom);
    showCard(cardNode, graph);
  }
});
setCardIsTagActive((tag) => filter.active.has(tag));
setCardGetTagColor(getTagColor);

// Update filter pill + card tag colors when grouping changes.
setOnGroupingChange(() => {
  updateFilterPillColors(getTagColor);
  const cardNode = getCurrentCardNode();
  if (cardNode) showCard(cardNode, graph);
});
updateFilterPillColors(getTagColor);

createMinimap(camera, graph, (x, y, animate) => {
  if (animate) {
    animateTo(camera, x, y, camera.zoom);
  } else {
    camera.x = x;
    camera.y = y;
    updateTransform(camera);
  }
});
updateTransform(camera);
window.addEventListener("resize", () => updateTransform(camera));
const focusLayout = createFocusLayout(graph);
const input = setupInput(document.getElementById("viewport")!, camera, graph, {
  onFocusChange: (node) => focusLayout.onFocusChange(node),
});
initPanel(camera, graph);

// Handle ?focus= query param (snap without animation on page load)
const focusId = new URLSearchParams(location.search).get("focus");
if (focusId) {
  const node = graph.nodes.find((n) => n.id === focusId);
  if (node) {
    input.navigateTo(node, false, false);
    if (!node.tags.includes("fragment")) {
      openPanel(node.id, node.label, false);
    }
  }
}

// Apply settings-driven attributes
const settings = getSettings();
if (settings.textOnCanvas) worldEl.dataset.textOnCanvas = "";
if (!settings.edgesVisible) worldEl.dataset.edgesHidden = "";
if (!settings.nodeGrowth) worldEl.dataset.noGrowth = "";

// Nudge nodes that overlap the landing element after fonts are ready.
// Keep noTransition active until this completes to prevent visible animation.
document.fonts.ready.then(() => {
  const rect = landingEl.getBoundingClientRect();
  const worldRect = worldEl.getBoundingClientRect();
  const zoom = camera.zoom || 1;
  // Convert landing pixel rect to world-space bounds
  const lCx = (rect.left + rect.width / 2 - worldRect.left) / zoom;
  const lCy = (rect.top + rect.height / 2 - worldRect.top) / zoom;
  const halfW = rect.width / zoom / 2 + 20; // 20px padding
  const halfH = rect.height / zoom / 2 + 20;

  let nudged = false;
  for (const node of graph.nodes) {
    if (node.tags.includes("meta")) continue;
    const dx = node.x - lCx;
    const dy = node.y - lCy;
    if (Math.abs(dx) < halfW + node.radius && Math.abs(dy) < halfH + node.radius) {
      // Push radially outward from landing center
      const dist = Math.hypot(dx, dy) || 1;
      const pushDist = Math.hypot(halfW + node.radius, halfH + node.radius) - dist + 5;
      if (pushDist > 0) {
        node.x += (dx / dist) * pushDist;
        node.y += (dy / dist) * pushDist;
        nudged = true;
      }
    }
  }
  if (nudged) updatePositions(graph);
  // Double-rAF: first rAF ensures the browser commits the nudged positions,
  // second rAF fires after paint — safe to re-enable transitions.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      delete worldEl.dataset.noTransition;
    });
  });
});

// Restore filters on popstate (back/forward)
function syncFilterPills(): void {
  const pills = document.querySelectorAll<HTMLElement>(".filter-pill[data-tag]");
  for (const pill of pills) {
    if (filter.active.has(pill.dataset.tag!)) {
      pill.dataset.active = "";
      pill.setAttribute("aria-pressed", "true");
    } else {
      delete pill.dataset.active;
      pill.setAttribute("aria-pressed", "false");
    }
  }
}

window.addEventListener("popstate", () => {
  const filterParam = new URLSearchParams(location.search).get("filter");
  const newTags = filterParam ? filterParam.split(",") : [];
  const current = [...filter.active].sort().join(",");
  const next = newTags.sort().join(",");
  if (current !== next) {
    setActive(filter, newTags);
    applyFilter(filter, graph);
    runFilterLayout();
    updatePositions(graph);
    syncFilterPills();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(siteUrl("/sw.js")).catch(() => {});
}
