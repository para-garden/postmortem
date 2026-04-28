/** Site-level configuration. Change these values to rebrand the site. */

export interface ContentGate {
  label: string;
  description: string;
}

export interface CollectionConfig {
  name: string;
  metaNodeId: string;
  /** Content directories to include when building this collection's graph. */
  contentDirs: string[];
}

export const siteConfig = {
  /** Display name shown in title bars and landing page. */
  name: "postmortem",
  /** Full domain for og:url and og:site_name. */
  domain: "para.garden",
  /** Base path for deployment (no trailing slash). E.g. "/postmortem" if served at /postmortem/. */
  basePath: "/postmortem",
  /** ID of the meta/landing node (default collection). */
  metaNodeId: "meta/postmortem",
  /** Content gates: tags that require user acknowledgment before panel content is shown. */
  contentGates: {} satisfies Record<string, ContentGate>,
  /** Per-collection overrides. */
  collections: {
    default: {
      name: "postmortem",
      metaNodeId: "meta/postmortem",
      contentDirs: ["meta", "world"],
    },
  } satisfies Record<string, CollectionConfig>,
} as const;

export type CollectionId = keyof typeof siteConfig.collections;

/** Prepend basePath to an absolute-path string. */
export function siteUrl(path: string): string {
  return siteConfig.basePath + path;
}

/** Detect active collection from <html data-collection="...">. Browser-only. */
export function getActiveCollection(): CollectionId {
  if (typeof document === "undefined") return "default";
  return (document.documentElement.dataset.collection as CollectionId) ?? "default";
}
