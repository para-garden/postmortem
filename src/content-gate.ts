import type { Node } from "./graph";
import { siteConfig } from "./site-config";

export interface GateEntry {
  key: string;
  label: string;
  description: string;
}

const STORAGE_PREFIX = "postmortem:cw:";

export function isAcknowledged(key: string): boolean {
  const storageKey = STORAGE_PREFIX + key;
  return (
    sessionStorage.getItem(storageKey) === "1" ||
    localStorage.getItem(storageKey) === "1"
  );
}

export function acknowledge(key: string, persist: boolean): void {
  const storageKey = STORAGE_PREFIX + key;
  if (persist) {
    localStorage.setItem(storageKey, "1");
  } else {
    sessionStorage.setItem(storageKey, "1");
  }
}

export function getUnacknowledgedGates(node: Node): GateEntry[] {
  const gates: GateEntry[] = [];

  for (const tag of node.tags) {
    const gate = (siteConfig.contentGates as Record<string, { label: string; description: string }>)[tag];
    if (gate && !isAcknowledged(tag)) {
      gates.push({ key: tag, label: gate.label, description: gate.description });
    }
  }

  if (node.contentWarning) {
    const key = `node:${node.id}`;
    if (!isAcknowledged(key)) {
      gates.push({ key, label: "Content warning", description: node.contentWarning });
    }
  }

  return gates;
}

export function showGate(
  gates: GateEntry[],
  onProceed: () => void,
  onBack: () => void,
): void {
  const overlay = document.createElement("div");
  overlay.id = "cw-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Content warning");

  const dialog = document.createElement("div");
  dialog.className = "cw-dialog";

  const heading = document.createElement("p");
  heading.className = "cw-heading";
  heading.textContent = "Content warning";
  dialog.appendChild(heading);

  for (const gate of gates) {
    const label = document.createElement("p");
    label.className = "cw-label";
    label.textContent = gate.label;
    dialog.appendChild(label);

    const desc = document.createElement("p");
    desc.className = "cw-desc";
    desc.innerHTML = gate.description;
    dialog.appendChild(desc);
  }

  const actions = document.createElement("div");
  actions.className = "cw-actions";

  const proceedBtn = document.createElement("button");
  proceedBtn.className = "cw-proceed";
  const labels = gates.map(g => g.label.toLowerCase());
  const labelList = labels.length <= 1
    ? labels[0] ?? ""
    : labels.slice(0, -1).join(", ") + " and " + labels[labels.length - 1];
  proceedBtn.textContent = `I understand this content includes depictions of ${labelList}, and I'm choosing to continue`;
  actions.appendChild(proceedBtn);

  const backBtn = document.createElement("button");
  backBtn.className = "cw-back";
  backBtn.textContent = "Go back";
  actions.appendChild(backBtn);

  dialog.appendChild(actions);

  const rememberRow = document.createElement("div");
  rememberRow.className = "cw-remember";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = "cw-remember-checkbox";

  const checkLabel = document.createElement("label");
  checkLabel.htmlFor = "cw-remember-checkbox";
  checkLabel.textContent = "Remember my choice";

  rememberRow.appendChild(checkbox);
  rememberRow.appendChild(checkLabel);
  dialog.appendChild(rememberRow);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Focus the proceed button initially
  proceedBtn.focus();

  function remove(): void {
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown);
  }

  function handleProceed(): void {
    const persist = checkbox.checked;
    for (const gate of gates) {
      acknowledge(gate.key, persist);
    }
    remove();
    onProceed();
  }

  function handleBack(): void {
    remove();
    onBack();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      handleBack();
      return;
    }
    // Focus trap
    if (e.key === "Tab") {
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>("button, input[type='checkbox']"),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  proceedBtn.addEventListener("click", handleProceed);
  backBtn.addEventListener("click", handleBack);
  document.addEventListener("keydown", onKeyDown);
}

export function revoke(key: string): void {
  const storageKey = STORAGE_PREFIX + key;
  localStorage.removeItem(storageKey);
  sessionStorage.removeItem(storageKey);
}

/** Returns CW tags on a node that are configured in siteConfig.contentGates. */
export function getCwTags(node: Node): string[] {
  const gates = siteConfig.contentGates as Record<string, unknown>;
  return node.tags.filter((t) => t in gates);
}

/** True if the node has any unacknowledged CW tag. */
export function isNodeCwHidden(node: Node): boolean {
  return getCwTags(node).some((t) => !isAcknowledged(t));
}

export function checkGate(
  node: Node,
  onProceed: () => void,
  onBack: () => void,
): void {
  const gates = getUnacknowledgedGates(node);
  if (gates.length === 0) {
    onProceed();
    return;
  }
  showGate(gates, onProceed, onBack);
}
