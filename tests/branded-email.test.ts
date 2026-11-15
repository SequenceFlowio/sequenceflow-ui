import assert from "node:assert/strict";
import test from "node:test";

import { escapeHtml, inline, renderBrandedEmail, textToBlocks } from "../lib/email/branded.ts";
import { mailPreviews } from "../lib/email/previews.ts";

test("tekst wordt veilig en links worden klikbaar", () => {
  assert.equal(escapeHtml(`<script>"x"&'y'</script>`), "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
  const html = inline("Zie https://www.sequenceflow.io/r/juju. Mail hallo@sequenceflow.io");
  assert.match(html, /href="https:\/\/www\.sequenceflow\.io\/r\/juju"/);
  assert.match(html, /href="mailto:hallo@sequenceflow\.io"/);
  // de punt achter de link hoort niet bij de link
  assert.doesNotMatch(html, /juju\."/);
  assert.doesNotMatch(inline("<b>vet</b>"), /<b>/);
});

test("tekstmail wordt alinea's, lijsten en een knop", () => {
  const { blocks, signature, greeting } = textToBlocks([
    "Hoi Juju,",
    "",
    "Eerste alinea.",
    "",
    "1. Eerste actie",
    "   Uitleg bij de eerste.",
    "2. Tweede actie",
    "",
    "- los punt",
    "",
    "Naar Support One: https://support.sequenceflow.io",
    "",
    "Groet,",
    "Seffy",
  ].join("\n"));
  assert.equal(greeting, "Hoi Juju,");
  assert.equal(signature, "Groet,\nSeffy");
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "list", "list", "button"]);
  const ordered = blocks[1] as Extract<typeof blocks[number], { type: "list" }>;
  assert.equal(ordered.items[0].text, "Uitleg bij de eerste.");
  assert.deepEqual(blocks[3], { type: "button", label: "Naar Support One", href: "https://support.sequenceflow.io" });
});

test("elke mail is een volledige HTML-pagina in huisstijl", () => {
  const html = renderBrandedEmail({ title: "Titel <x>", blocks: [{ type: "paragraph", text: "Tekst" }], footer: ["Waarom je dit krijgt"] });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /logo-white\.png/);
  assert.match(html, /Titel &lt;x&gt;/);
  assert.match(html, /KvK 78237750/);
  for (const preview of mailPreviews()) {
    assert.ok(preview.html.length > 1000, preview.key);
    assert.doesNotMatch(preview.html, /undefined|NaN|\[object Object\]/, preview.key);
  }
});
