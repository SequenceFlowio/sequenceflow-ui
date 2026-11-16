import fs from "node:fs";
import path from "node:path";

import { marked } from "marked";

import { figureHtml } from "./blogFigures";
import { isLive, parseFrontMatter, publishMoment } from "./blogSchedule";

/**
 * Blog posts are Markdown files in content/blog with a small front matter
 * block (key: value lines between ---). Een post met een publishDate in de
 * toekomst is gepland: de site toont hem pas vanaf die dag 07:00 (zie
 * blogSchedule.ts). De blogpagina's verversen elk uur, dus geplande posts gaan
 * vanzelf live zonder nieuwe deploy.
 */
const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const SLUG = /^[a-z0-9-]+$/;

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  tag: string;
  author: string;
  publishDate: string;
  readTime: string;
  /** Naam van een figuur uit blogFigures.ts, bovenaan de post en op de kaart. */
  cover: string;
  /** Het zoekwoord waar de post op moet ranken (alleen voor de backoffice). */
  keyword: string;
  /** Moment van publicatie in ms, 0 als de datum ontbreekt. */
  publishAt: number;
};

function readPost(slug: string) {
  const { data, body } = parseFrontMatter(fs.readFileSync(path.join(BLOG_DIR, `${slug}.md`), "utf8"));
  const publishDate = data.publishDate ?? "";
  const post: BlogPost = {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    tag: data.tag ?? "",
    author: data.author ?? "SequenceFlow",
    publishDate,
    readTime: data.readTime ?? "",
    cover: data.cover ?? "",
    keyword: data.keyword ?? "",
    publishAt: publishMoment(publishDate),
  };
  return { post, body };
}

/** Alle posts, ook de geplande, nieuwste eerst. Alleen voor de backoffice. */
export function listAllBlogPosts(): BlogPost[] {
  return fs.readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => readPost(file.slice(0, -3)).post)
    .sort((a, b) => b.publishAt - a.publishAt);
}

/** De posts die nu live staan, nieuwste eerst. */
export function listBlogPosts(now = Date.now()): BlogPost[] {
  return listAllBlogPosts().filter((post) => isLive(post.publishDate, now));
}

export function getBlogPost(slug: string, now = Date.now()) {
  const post = getBlogPostPreview(slug);
  return post && isLive(post.publishDate, now) ? post : null;
}

/** Een post ongeacht de datum, voor het voorbeeld in de backoffice. */
export function getBlogPostPreview(slug: string) {
  if (!SLUG.test(slug) || !fs.existsSync(path.join(BLOG_DIR, `${slug}.md`))) return null;
  const { post, body } = readPost(slug);
  const html = marked.parse(body, { async: false })
    .replace(/<p>::figure\[([a-z0-9-]+)\]<\/p>/g, (_, name: string) => figureHtml(name));
  return { ...post, html, coverHtml: post.cover ? figureHtml(post.cover) : "" };
}

/** Gerelateerde posts: eerst dezelfde tag, dan de nieuwste. */
export function relatedBlogPosts(slug: string, tag: string, count = 3, now = Date.now()) {
  const others = listBlogPosts(now).filter((post) => post.slug !== slug);
  return [...others.filter((post) => post.tag === tag), ...others.filter((post) => post.tag !== tag)].slice(0, count);
}
