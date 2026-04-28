/**
 * Shared content utilities for build scripts.
 * Single source of truth for walking content directories.
 */
import { readdir, stat } from "fs/promises";
import { join } from "path";

export const CONTENT_DIR = join(import.meta.dir, "../public/content");

/** Config-only directories: parsed for config, not content nodes. */
const CONFIG_DIRS = new Set(["cluster"]);

export interface ContentFile {
  id: string;
  path: string;
  category: string;
}

/**
 * Walk specified content directories and return all markdown files.
 * `cluster/` is always included (config, not content).
 * If `dirs` is omitted, walks everything.
 */
export async function findMarkdownFiles(
  baseDir: string,
  dirs?: string[],
): Promise<ContentFile[]> {
  if (!dirs) {
    return walkDir(baseDir, "");
  }

  // Always include cluster configs
  const allDirs = [...new Set([...dirs, ...CONFIG_DIRS])];
  const results: ContentFile[] = [];

  for (const dir of allDirs) {
    const dirPath = join(baseDir, dir);
    try {
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory()) continue;
    } catch {
      continue; // directory doesn't exist, skip
    }
    const files = await walkDir(dirPath, dir);
    results.push(...files);
  }

  return results;
}

async function walkDir(dir: string, prefix: string): Promise<ContentFile[]> {
  const entries = await readdir(dir);
  const results: ContentFile[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      const subPrefix = prefix ? `${prefix}/${entry}` : entry;
      const subResults = await walkDir(fullPath, subPrefix);
      results.push(...subResults);
    } else if (entry.endsWith(".md")) {
      const basename = entry.replace(/\.md$/, "");
      const id = prefix ? `${prefix}/${basename}` : basename;
      const category = prefix.split("/")[0] || "";
      results.push({ id, path: fullPath, category });
    }
  }

  return results;
}
