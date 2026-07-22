import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync(new URL("../components/UpgradeModal.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../components/Sidebar.tsx", import.meta.url), "utf8");

test("manually opened account recovery can always be dismissed", () => {
  assert.match(modal, /aria-label="Sluit planselectie"/);
  assert.match(modal, /onClick=\{close\}/);
  assert.doesNotMatch(sidebar, /openUpgrade\(\{ forced: true \}\)/);
});
