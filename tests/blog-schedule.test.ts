import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { BLOG_FIGURES } from "../lib/marketing/blogFigures.ts";
import { extractFaq, isLive, parseDutchDate, parseFrontMatter, POSTS_PER_WEEK_TARGET, publishMoment, weekKey, weeklyCadence } from "../lib/marketing/blogSchedule.ts";

const DIR = path.join(process.cwd(), "content", "blog");
const posts = fs.readdirSync(DIR).filter((file) => file.endsWith(".md")).map((file) => {
  const { data, body } = parseFrontMatter(fs.readFileSync(path.join(DIR, file), "utf8"));
  return { slug: file.slice(0, -3), data, body };
});

test("een geplande post gaat om 07:00 Nederlandse tijd live, ook in de zomer", () => {
  assert.equal(new Date(publishMoment("18 nov 2026")).toISOString(), "2026-11-18T06:00:00.000Z");
  assert.equal(new Date(publishMoment("1 jul 2026")).toISOString(), "2026-07-01T05:00:00.000Z");
  assert.equal(isLive("18 nov 2026", Date.parse("2026-11-18T05:59:00Z")), false);
  assert.equal(isLive("18 nov 2026", Date.parse("2026-11-18T06:00:00Z")), true);
  assert.equal(parseDutchDate("31 foo 2026"), null);
  assert.equal(publishMoment(""), 0);
  assert.equal(isLive(""), true);
});

test("weken lopen van maandag tot zondag en tellen tekorten", () => {
  assert.equal(weekKey(publishMoment("22 nov 2026")), "2026-11-16");
  assert.equal(weekKey(publishMoment("23 nov 2026")), "2026-11-23");
  const weeks = weeklyCadence(["17 nov 2026", "18 nov 2026", "20 nov 2026", "22 nov 2026", "25 nov 2026"], Date.parse("2026-11-16T09:00:00Z"), 3);
  assert.deepEqual(weeks.map((week) => [week.week, week.count, week.enough]), [["2026-11-16", 4, true], ["2026-11-23", 1, false], ["2026-11-30", 0, false]]);
});

test("elke post heeft complete front matter en een bestaande figuur", () => {
  const titles = new Set<string>();
  for (const post of posts) {
    for (const key of ["title", "description", "tag", "publishDate", "readTime", "cover", "keyword"]) {
      assert.ok(post.data[key], `${post.slug} mist ${key}`);
    }
    assert.ok(parseDutchDate(post.data.publishDate), `${post.slug}: datum onleesbaar`);
    assert.ok(BLOG_FIGURES[post.data.cover], `${post.slug}: figuur ${post.data.cover} bestaat niet`);
    for (const [, name] of post.body.matchAll(/::figure\[([a-z0-9-]+)\]/g)) assert.ok(BLOG_FIGURES[name], `${post.slug}: figuur ${name} bestaat niet`);
    assert.ok(post.data.description.length <= 200, `${post.slug}: description te lang voor Google`);
    assert.ok(!titles.has(post.data.title), `${post.slug}: dubbele titel`);
    titles.add(post.data.title);
  }
});

test("interne links wijzen alleen naar posts die op dat moment al live staan", () => {
  const bySlug = new Map(posts.map((post) => [post.slug, publishMoment(post.data.publishDate)]));
  for (const post of posts) {
    for (const [, target] of post.body.matchAll(/\]\(\/blog\/([a-z0-9-]+)\)/g)) {
      assert.ok(bySlug.has(target), `${post.slug} linkt naar onbekende post ${target}`);
      assert.ok(bySlug.get(target)! <= bySlug.get(post.slug)!, `${post.slug} linkt naar ${target}, die later live gaat`);
    }
  }
});

test("de planning haalt het weekdoel van 17 nov tot en met 20 dec 2026", () => {
  const weeks = weeklyCadence(posts.map((post) => post.data.publishDate), Date.parse("2026-11-16T09:00:00Z"), 5);
  for (const week of weeks) assert.ok(week.count >= POSTS_PER_WEEK_TARGET, `week van ${week.week}: ${week.count} posts`);
});

test("van 26 nov tot en met 26 dec 2026 staat er elke dag precies één post", () => {
  const perDay = new Map<string, number>();
  for (const post of posts) {
    const day = new Date(publishMoment(post.data.publishDate) + 12 * 3600_000).toISOString().slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  for (let time = Date.parse("2026-11-26T12:00:00Z"); time <= Date.parse("2026-12-26T12:00:00Z"); time += 86_400_000) {
    const day = new Date(time).toISOString().slice(0, 10);
    assert.equal(perDay.get(day), 1, `${day}: ${perDay.get(day) ?? 0} posts`);
  }
});

test("posts met een kort antwoord zijn GEO-klaar: antwoord, FAQ en zoekwoord", () => {
  const geo = posts.filter((post) => post.data.summary);
  assert.ok(geo.length >= 17, `maar ${geo.length} posts met een kort antwoord`);
  for (const post of geo) {
    const words = post.data.summary.split(/\s+/).length;
    assert.ok(words >= 25 && words <= 85, `${post.slug}: kort antwoord van ${words} woorden (25–85)`);
    const faq = extractFaq(post.body);
    assert.ok(faq.length >= 3, `${post.slug}: ${faq.length} FAQ-vragen, minstens 3`);
    for (const item of faq) assert.ok(item.question.endsWith("?"), `${post.slug}: "${item.question}" is geen vraag`);
    const firstWord = post.data.keyword.split(" ")[0].toLowerCase();
    assert.ok(`${post.data.title} ${post.data.description}`.toLowerCase().includes(firstWord), `${post.slug}: zoekwoord "${post.data.keyword}" niet in titel of beschrijving`);
    assert.ok(/^## /m.test(post.body) && /::figure\[/.test(post.body), `${post.slug}: mist tussenkoppen of figuur`);
  }
});
