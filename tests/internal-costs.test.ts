import assert from "node:assert/strict";
import test from "node:test";

import { marginPct, modelPrice, stripeFeeEur, usageCostEur, USD_TO_EUR } from "../lib/internal/costs.ts";

test("AI cost follows the published token prices, cached input cheaper", () => {
  const cost = usageCostEur({ model: "gpt-4.1-mini", prompt_tokens: 1_000_000, cached_input_tokens: 0, completion_tokens: 0 });
  assert.equal(cost.toFixed(4), (0.4 * USD_TO_EUR).toFixed(4));
  const cached = usageCostEur({ model: "gpt-4.1-mini", prompt_tokens: 1_000_000, cached_input_tokens: 1_000_000, completion_tokens: 0 });
  assert.ok(cached < cost);
  // Een gemiddeld klantgesprek (1.723 in, 210 uit) kost een fractie van een cent.
  assert.ok(usageCostEur({ model: "gpt-4.1-mini", prompt_tokens: 1723, cached_input_tokens: 0, completion_tokens: 210 }) < 0.002);
});

test("an unknown model is priced high, never as free", () => {
  assert.equal(modelPrice("some-new-model").estimate, true);
  assert.ok(usageCostEur({ model: null, prompt_tokens: 1000, cached_input_tokens: 0, completion_tokens: 1000 }) > 0);
  assert.equal(modelPrice("gpt-4.1-mini-2025-04-14").input, 0.4);
});

test("Stripe fee and margin", () => {
  assert.equal(stripeFeeEur(0), 0);
  assert.equal(stripeFeeEur(149).toFixed(2), "4.27");
  assert.equal(marginPct(100, 12), 88);
  assert.equal(marginPct(0, 5), null);
});

test("only listed e-mail addresses see the internal dashboard", async () => {
  const { isPlatformAdminEmail } = await import("../lib/internal/platformAdmin.ts");
  assert.equal(isPlatformAdminEmail("Navaron@Example.com", "navaron@example.com, ezra@example.com"), true);
  assert.equal(isPlatformAdminEmail("someone@example.com", "navaron@example.com"), false);
  assert.equal(isPlatformAdminEmail("navaron@example.com", ""), false);
  assert.equal(isPlatformAdminEmail(null, "navaron@example.com"), false);
});
