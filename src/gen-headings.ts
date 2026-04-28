import { readFile, writeFile } from "fs/promises";
import { stripFrontmatter } from "./frontmatter";
import { findMarkdownFiles, CONTENT_DIR } from "./content";

const NAV_HEADINGS = new Set(["related projects", "see also", "what it is"]);

/**
 * Extract headings from content files and write a JSON index.
 * If dirs is omitted, scans all content directories.
 */
export async function generateHeadings(dirs?: string[], outPath = "dist/headings.json"): Promise<void> {
  const headings: { nodeId: string; heading: string; slug: string; body: string }[] = [];

  const files = await findMarkdownFiles(CONTENT_DIR, dirs);

  for (const { id, path } of files) {
    const raw = await readFile(path, "utf-8");
    const text = stripFrontmatter(raw);

    const sections = text.split(/^## /m);
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i]!;
      const newlineIdx = section.indexOf("\n");
      if (newlineIdx === -1) continue;
      const heading = section.substring(0, newlineIdx).trim();
      if (NAV_HEADINGS.has(heading.toLowerCase())) continue;

      const body = section.substring(newlineIdx + 1).trim();
      const plainBody = body
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*_`#]/g, "")
        .replace(/\n+/g, " ")
        .trim();

      const slug = heading
        .toLowerCase()
        .replace(/'/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      headings.push({ nodeId: id, heading, slug, body: plainBody });
    }
  }

  headings.sort((a, b) => a.nodeId.localeCompare(b.nodeId) || a.heading.localeCompare(b.heading));

  await writeFile(outPath, JSON.stringify(headings));
  console.log(`wrote ${headings.length} headings to ${outPath}`);
}

// Standalone entry point
if (import.meta.path === Bun.main) {
  const args = Bun.argv.slice(2).filter((a) => !a.startsWith("-"));
  await generateHeadings(args.length > 0 ? args : undefined);
}
