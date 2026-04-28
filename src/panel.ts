import type { Camera } from "./camera";
import type { Graph, Node } from "./graph";
import { updateTransform, setFocus, animateTo } from "./dom";
import { hideCard } from "./card";
import { parseMarkdown } from "./markdown";
import { siteUrl } from "./site-config";
import { checkGate } from "./content-gate";

let panel: HTMLElement;
let panelTitle: HTMLElement;
let panelBody: HTMLElement;
let panelOpen: HTMLAnchorElement;
let divider: HTMLElement;
let cam: Camera;
let graphRef: Graph;

let currentNodeId: string | null = null;
export const contentCache = new Map<string, { html: string; format?: string; theme?: string }>();

const FALLBACK = "<p style=\"color:#666\">No detailed page available yet.</p>";

function prepareContent(container: HTMLElement): void {
  const children: Element[] = [];
  while (container.firstElementChild) {
    children.push(container.removeChild(container.firstElementChild) as Element);
  }

  let section: HTMLElement | null = null;
  let body: HTMLElement | null = null;

  const NAV_HEADINGS = ["see also", "related projects"];

  for (const child of children) {
    if (child.tagName === "H2") {
      if (section) container.appendChild(section);

      const text = (child.textContent ?? "").toLowerCase().trim();
      if (NAV_HEADINGS.includes(text)) {
        section = null;
        body = null;
        container.appendChild(child);
        continue;
      }

      const slug = text.replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      const sec = document.createElement("section");
      sec.className = "collapsible-section";
      sec.id = slug;
      sec.appendChild(child);
      child.setAttribute("aria-expanded", "false");

      const bd = document.createElement("div");
      bd.className = "section-body";
      sec.appendChild(bd);

      function syncExpanded(): void {
        child.setAttribute("aria-expanded", sec.classList.contains("expanded") ? "true" : "false");
      }

      child.addEventListener("click", () => {
        sec.classList.toggle("expanded");
        syncExpanded();
      });

      bd.addEventListener("click", (e) => {
        if (!sec.classList.contains("expanded")) {
          if ((e.target as HTMLElement).closest?.("a")) return; // let links through
          e.preventDefault();
          e.stopPropagation();
          sec.classList.add("expanded");
          syncExpanded();
        } else if (!(e.target as HTMLElement).closest?.("a")) {
          sec.classList.remove("expanded");
          syncExpanded();
        }
      });

      section = sec;
      body = bd;
    } else if (body) {
      body.appendChild(child);
    } else {
      container.appendChild(child);
    }
  }

  if (section) container.appendChild(section);
}

/** Wrap [HH:MM:SS] timestamps in transcript format with styled spans. */
function prepareTranscript(container: HTMLElement): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const replacements: { node: Text; html: string }[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? "";
    if (/\[\d{2}:\d{2}:\d{2}\]/.test(text)) {
      replacements.push({
        node,
        html: text.replace(/\[(\d{2}:\d{2}:\d{2})\]/g, '<span class="ts">[$1]</span>'),
      });
    }
  }
  for (const { node: n, html } of replacements) {
    const span = document.createElement("span");
    span.innerHTML = html;
    n.parentNode?.replaceChild(span, n);
  }
}

/** Convert italic "tags: x, y, z" lines in blog format to pill elements. */
function prepareBlog(container: HTMLElement): void {
  for (const em of container.querySelectorAll("em")) {
    const text = em.textContent ?? "";
    if (!text.startsWith("tags:")) continue;
    const tags = text.slice(5).split(",").map(t => t.trim()).filter(Boolean);
    const div = document.createElement("div");
    div.className = "blog-tags";
    for (const tag of tags) {
      const span = document.createElement("span");
      span.className = "blog-tag";
      span.textContent = tag;
      div.appendChild(span);
    }
    const parent = em.parentElement;
    if (parent?.tagName === "P") parent.replaceWith(div);
  }
}

export function fetchContent(nodeId: string): Promise<{ html: string; format?: string; theme?: string }> {
  const cached = contentCache.get(nodeId);
  if (cached !== undefined) return Promise.resolve(cached);

  return fetch(siteUrl(`/content/${nodeId}.md`))
    .then((res) => {
      if (!res.ok) throw new Error("not found");
      return res.text();
    })
    .then((md) => {
      const result = parseMarkdown(md);
      contentCache.set(nodeId, result);
      return result;
    })
    .catch(() => {
      const result = { html: FALLBACK };
      contentCache.set(nodeId, result);
      return result;
    });
}

export function initPanel(camera: Camera, graph: Graph): void {
  cam = camera;
  graphRef = graph;
  panel = document.getElementById("panel")!;
  panelTitle = document.getElementById("panel-title")!;
  panelBody = document.getElementById("panel-body")!;
  panelOpen = document.getElementById("panel-open") as HTMLAnchorElement;
  divider = document.getElementById("panel-divider")!;

  // Close button
  document.getElementById("panel-close")!.addEventListener("click", closePanel);

  // Divider drag
  const isVertical = () => window.matchMedia("(max-width: 640px)").matches;
  let dragging = false;

  function startDrag(e: Event) {
    e.preventDefault();
    dragging = true;
    document.body.style.cursor = isVertical() ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  }

  function onDrag(x: number, y: number) {
    if (!dragging) return;
    if (isVertical()) {
      const h = Math.max(120, Math.min(window.innerHeight * 0.8, window.innerHeight - y));
      panel.style.height = `${h}px`;
    } else {
      const w = Math.max(240, Math.min(window.innerWidth * 0.6, window.innerWidth - x));
      panel.style.width = `${w}px`;
    }
    updateTransform(cam);
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  divider.addEventListener("mousedown", startDrag);
  window.addEventListener("mousemove", (e) => onDrag(e.clientX, e.clientY));
  window.addEventListener("mouseup", endDrag);

  divider.addEventListener("touchstart", startDrag, { passive: false });
  window.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    if (t) {
      onDrag(t.clientX, t.clientY);
    }
  });
  window.addEventListener("touchend", endDrag);

  // Link interception — crosslinks and in-page anchors
  panelBody.addEventListener("click", (e) => {
    if (e.ctrlKey || e.metaKey) return;
    const anchor = (e.target as HTMLElement).closest?.("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;

    // In-page anchor — scroll to section and expand
    if (href.startsWith("#")) {
      e.preventDefault();
      const sec = panelBody.querySelector<HTMLElement>(href);
      if (sec?.classList.contains("collapsible-section")) {
        sec.classList.add("expanded");
        const heading = sec.querySelector("h2");
        if (heading) heading.setAttribute("aria-expanded", "true");
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    // Cross-node link (e.g., /project/normalize, /ecosystem/rhi)
    if (/^\/[a-z][\w-]*(\/[a-z][\w-]*)*$/.test(href)) {
      e.preventDefault();
      openPanel(href.slice(1));
    }
  });
}

export function openPanel(nodeId: string, nodeLabel?: string, push = true): void {
  hideCard();
  currentNodeId = nodeId;

  panelTitle.textContent = nodeLabel ?? nodeId;
  panelOpen.href = siteUrl(`/${nodeId}`);

  const node = graphRef.nodes.find(n => n.id === nodeId);
  const isEssay = node?.tags.includes("essay") ?? false;
  if (node) {
    setFocus(graphRef, node);
    animateTo(cam, node.x, node.y, Math.max(cam.zoom, 1.5));
  }
  if (push) {
    const params = new URLSearchParams(location.search);
    params.set("focus", nodeId);
    const qs = params.toString();
    history.pushState({ focus: nodeId }, "", qs ? `?${qs}` : location.pathname);
  }

  function proceed(): void {
    panel.hidden = false;
    panelBody.scrollTop = 0;
    updateTransform(cam);

    const cached = contentCache.get(nodeId);
    if (cached !== undefined) {
      panelBody.innerHTML = cached.html;
      panelBody.dataset.format = cached.format ?? "";
      panelBody.dataset.theme = cached.theme ?? "";
      if (!cached.format && isEssay) prepareContent(panelBody);
      if (cached.format === "transcript") prepareTranscript(panelBody);
      if (cached.format === "blog") prepareBlog(panelBody);
      return;
    }

    panelBody.innerHTML = "<p style=\"color:#666\">Loading\u2026</p>";

    fetchContent(nodeId).then(({ html, format, theme }) => {
      if (currentNodeId === nodeId) {
        panelBody.innerHTML = html;
        panelBody.dataset.format = format ?? "";
        panelBody.dataset.theme = theme ?? "";
        if (!format && isEssay) prepareContent(panelBody);
        if (format === "transcript") prepareTranscript(panelBody);
        if (format === "blog") prepareBlog(panelBody);
      }
    });
  }

  if (node) {
    checkGate(node, proceed, () => { /* stay as-is */ });
  } else {
    proceed();
  }
}

export function closePanel(): void {
  panel.hidden = true;
  currentNodeId = null;
  updateTransform(cam);
}

export function isPanelOpen(): boolean {
  return !panel.hidden;
}

export function panelNode(): Node | null {
  if (!currentNodeId || panel.hidden) return null;
  return graphRef.nodes.find(n => n.id === currentNodeId) ?? null;
}
