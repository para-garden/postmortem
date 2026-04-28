/** Markdown → HTML using remark+rehype. */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { parse as parseYaml } from "yaml";
import type { Root, Element } from "hast";

// Tags where inline quote wrapping applies
const TEXT_TAGS: Record<string, true> = {
  p: true, li: true, blockquote: true,
  h1: true, h2: true, h3: true, h4: true, h5: true, h6: true,
  td: true, th: true,
  q: true, span: true, sub: true, sup: true,
  strong: true, em: true, b: true, i: true, u: true,
};

function rehypeParseInlineQuotes() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (!TEXT_TAGS[node.tagName]) return;
      const newChildren: Element["children"] = [];
      let quoteChildren: Element["children"] | undefined;
      for (const child of node.children) {
        if (child.type !== "text") {
          (quoteChildren ?? newChildren).push(child);
          continue;
        }
        const parts = child.value.match(/[^"]+|"/g);
        if (!parts) continue;
        for (const part of parts) {
          if (part === '"') {
            if (quoteChildren) {
              newChildren.push({
                type: "element",
                tagName: "q",
                properties: {},
                children: quoteChildren,
              });
              quoteChildren = undefined;
            } else {
              quoteChildren = [];
            }
          } else {
            (quoteChildren ?? newChildren).push({ type: "text", value: part });
          }
        }
      }
      if (quoteChildren) {
        newChildren.push({
          type: "element",
          tagName: "q",
          properties: {},
          children: quoteChildren,
        });
      }
      node.children = newChildren;
    });
  };
}

/** External links get target="_blank" and rel="noopener". */
function rehypeExternalLinks() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href === "string" && /^https?:\/\//.test(href)) {
        node.properties!.target = "_blank";
        node.properties!.rel = "noopener";
      }
    });
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeParseInlineQuotes)
  .use(rehypeExternalLinks)
  .use(rehypeStringify);

export function parseMarkdown(src: string): { html: string; format?: string; theme?: string } {
  let format: string | undefined;
  let theme: string | undefined;
  let body = src;

  if (src.startsWith("---\n")) {
    const end = src.indexOf("\n---", 4);
    if (end !== -1) {
      const yamlStr = src.slice(4, end);
      try {
        const fm = parseYaml(yamlStr) as Record<string, unknown>;
        format = typeof fm.format === "string" ? fm.format : undefined;
        theme = typeof fm.theme === "string" ? fm.theme : undefined;
      } catch { /* malformed frontmatter */ }
      body = src.slice(end + 4).trimStart();
    }
  }

  const html = String(processor.processSync(body));
  return { html, format, theme };
}
