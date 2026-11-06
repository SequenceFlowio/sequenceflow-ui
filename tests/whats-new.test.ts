import assert from "node:assert/strict";
import test from "node:test";

import { WHATS_NEW, categoryLabel, unseenCount, visibleEntries, type WhatsNewEntry } from "../lib/whatsNew.ts";

test("every entry has a unique id, a real date and text in both languages", () => {
  const ids = new Set<string>();
  for (const entry of WHATS_NEW) {
    assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`);
    ids.add(entry.id);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(`${entry.date}T12:00:00Z`).toISOString().slice(0, 10), entry.date);
    for (const text of [entry.title, entry.body, ...(entry.link ? [entry.link.label] : [])]) {
      assert.ok(text.nl.trim() && text.en.trim(), `missing text in ${entry.id}`);
    }
    if (entry.link) assert.ok(entry.link.href.startsWith("/"), `link in ${entry.id} stays inside the app`);
  }
});

test("entries are shown newest first", () => {
  const dates = visibleEntries(WHATS_NEW, { inventory: true }).map((entry) => entry.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test("stock entries are hidden while Stock is switched off", () => {
  const off = visibleEntries(WHATS_NEW, { inventory: false });
  assert.ok(off.length > 0);
  assert.ok(off.every((entry) => !entry.inventory));
  assert.ok(visibleEntries(WHATS_NEW, { inventory: true }).some((entry) => entry.inventory));
});

test("the badge counts only entries not seen yet", () => {
  const entries: WhatsNewEntry[] = ["a", "b", "c"].map((id) => ({ id, date: "2026-11-01", category: "new", title: { nl: id, en: id }, body: { nl: id, en: id } }));
  assert.equal(unseenCount(entries, new Set()), 3);
  assert.equal(unseenCount(entries, new Set(["a", "c", "removed-entry"])), 1);
  assert.equal(unseenCount(entries, new Set(["a", "b", "c"])), 0);
});

test("categories have Dutch and English labels", () => {
  assert.equal(categoryLabel("new", true), "Nieuw");
  assert.equal(categoryLabel("improved", false), "Improved");
  assert.equal(categoryLabel("fixed", true), "Opgelost");
});
