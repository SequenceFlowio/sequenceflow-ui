import fs from "node:fs";
import path from "node:path";

import { marked } from "marked";

/**
 * Blog posts are Markdown files in content/blog with a small front matter
 * block (key: value lines between ---). The pages are rendered at build time.
 */
const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const SLUG = /^[a-z0-9-]+$/;
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  tag: string;
  author: string;
  publishDate: string;
  readTime: string;
};

function parseFrontMatter(source: string) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {} as Record<string, string>, body: source };
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");
  }
  return { data, body: match[2] };
}

/** "30 mrt 2026" → timestamp, for sorting newest first. */
function dutchDateValue(value: string) {
  const [day, month, year] = value.toLowerCase().split(/\s+/);
  const monthIndex = MONTHS.indexOf(month ?? "");
  return monthIndex < 0 ? 0 : Date.UTC(Number(year), monthIndex, Number(day));
}

function readPost(slug: string) {
  const { data, body } = parseFrontMatter(fs.readFileSync(path.join(BLOG_DIR, `${slug}.md`), "utf8"));
  const post: BlogPost = {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    tag: data.tag ?? "",
    author: data.author ?? "SequenceFlow",
    publishDate: data.publishDate ?? "",
    readTime: data.readTime ?? "",
  };
  return { post, body };
}

export function listBlogPosts(): BlogPost[] {
  return fs.readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => readPost(file.slice(0, -3)).post)
    .sort((a, b) => dutchDateValue(b.publishDate) - dutchDateValue(a.publishDate));
}

export function getBlogPost(slug: string) {
  if (!SLUG.test(slug) || !fs.existsSync(path.join(BLOG_DIR, `${slug}.md`))) return null;
  const { post, body } = readPost(slug);
  return { ...post, html: marked.parse(body, { async: false }) };
}
