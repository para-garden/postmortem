import { mkdir, readFile } from "node:fs/promises";
import { parseMarkdown } from "./markdown";
import { parseFrontmatter, stripFrontmatter } from "./frontmatter";
import { siteConfig } from "./site-config";
import { findMarkdownFiles, CONTENT_DIR } from "./content";

function pageHtml(
  id: string,
  title: string,
  description: string,
  body: string,
  format?: string,
  theme?: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ${siteConfig.name}</title>
  <link rel="icon" href="${siteConfig.basePath}/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600&family=Merriweather:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${siteConfig.basePath}/theme.css">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="https://${siteConfig.domain}/${id}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${siteConfig.domain}">
  <meta name="description" content="${description}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #0a0a0a; color: #ddd; font-size: 16px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    nav { padding: 16px 24px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; }
    nav a { color: #6a9; text-decoration: none; font-size: 14px; }
    nav a:hover { text-decoration: underline; }
    article { max-width: 720px; margin: 0 auto; padding: 32px 24px 64px; }
  </style>
</head>
<body>
  <nav>
    <a href="${siteConfig.basePath}/">← back to map</a>
    <a href="${siteConfig.basePath}/?focus=${id}">view on map</a>
  </nav>
  <article>
    <div id="panel-body"${format ? ` data-format="${format}"` : ""}${theme ? ` data-theme="${theme}"` : ""}>
${body}
    </div>
  </article>
</body>
</html>`;
}

export async function generatePages(): Promise<void> {
const files = await findMarkdownFiles(CONTENT_DIR);

let count = 0;
for (const { id, path } of files) {
  const raw = await readFile(path, "utf-8");
  const fm = parseFrontmatter(raw);
  const md = stripFrontmatter(raw);
  const { html } = parseMarkdown(md);
  const format = typeof fm?.format === "string" ? fm.format : undefined;
  const theme = typeof fm?.theme === "string" ? fm.theme : undefined;

  const title = fm?.label ?? id.split("/").pop() ?? id;
  const description = fm?.description?.replace(/\n/g, " ") ?? "";

  const outDir = `dist/${id}`;
  await mkdir(outDir, { recursive: true });
  await Bun.write(`${outDir}/index.html`, pageHtml(id, title, description, html, format, theme));
  count++;
}

console.log(`generated ${count} content pages`);
}

// Standalone entry point
if (import.meta.path === Bun.main) {
  await generatePages();
}
