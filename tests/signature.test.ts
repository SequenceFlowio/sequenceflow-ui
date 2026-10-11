import assert from "node:assert/strict";
import test from "node:test";

import { appendConfiguredSignature } from "../lib/email/signature.ts";

const signature = "Met vriendelijke groet,\nTeam SequenceFlow Test";

test("the model's own closing is removed; only the signature closes the reply, without a -- line", () => {
  const body = "Hoi Navaron,\n\nKun je de trackinginformatie controleren? Laat het ons weten.\n\nGroetjes!";
  assert.equal(
    appendConfiguredSignature(body, signature),
    "Hoi Navaron,\n\nKun je de trackinginformatie controleren? Laat het ons weten.\n\nMet vriendelijke groet,\nTeam SequenceFlow Test",
  );
});

test("closings in several languages and forms are removed", () => {
  for (const closing of ["Best regards,", "Kind regards", "Cheers!", "Fijne dag nog!", "Groetjes 😊", "Met vriendelijke groeten,\nLisa", "Viele Grüße", "Cordialement,"]) {
    const result = appendConfiguredSignature(`Hallo,\n\nJe pakket is onderweg.\n\n${closing}`, signature);
    assert.equal(result, `Hallo,\n\nJe pakket is onderweg.\n\n${signature}`, closing);
  }
});

test("a draft that already carries the signature (old format with --) is not signed twice", () => {
  const old = "Hallo,\n\nJe pakket is onderweg.\n\nGroetjes!\n\n--\nMet vriendelijke groet,\nTeam SequenceFlow Test";
  assert.equal(appendConfiguredSignature(old, signature), `Hallo,\n\nJe pakket is onderweg.\n\n${signature}`);
});

test("a thank-you line followed by real content is kept", () => {
  const body = "Bedankt!\n\nWe hebben je retour ontvangen en het geld is vandaag teruggestort op je rekening, je ziet het binnen twee werkdagen.";
  assert.equal(appendConfiguredSignature(body, signature), `${body}\n\n${signature}`);
});

test("approve & send replies under the customer's own subject", async () => {
  const { readFileSync } = await import("node:fs");
  const route = readFileSync(new URL("../app/api/tickets/[id]/approve-send/route.ts", import.meta.url), "utf8");
  assert.match(route, /const finalSubjectOriginal = asReply\(conversation\.subject_original\) \|\| decision\.draft_subject_original/);
});
