import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("integrations is an admin-only primary navigation destination", () => {
  const sidebar = source("components/Sidebar.tsx");
  const layout = source("app/(app)/layout.tsx");
  const page = source("app/(app)/integrations/page.tsx");
  const proxy = source("proxy.ts");

  assert.match(sidebar, /key: "integrations"[\s\S]+href: "\/integrations"[\s\S]+adminOnly: true/);
  assert.match(sidebar, /NAV_ITEMS\.filter\(\(item\) => !item\.adminOnly \|\| isAdmin\)/);
  assert.match(layout, /select\("tenant_id, role"\)/);
  assert.match(layout, /<AppShell isAdmin=\{planInfo\?\.isAdmin \?\? false\}>/);
  assert.match(page, /context\.role !== "admin"/);
  assert.match(page, /redirect\("\/settings"\)/);
  assert.match(proxy, /"\/integrations"/);
});

test("legacy integration links redirect while preserving callback parameters", () => {
  const settingsPage = source("app/(app)/settings/page.tsx");
  const inbox = source("app/(app)/inbox/page.tsx");

  assert.match(settingsPage, /params\.tab === "integrations"/);
  assert.match(settingsPage, /key === "tab"/);
  assert.match(settingsPage, /preserved\.append\(key, item\)/);
  assert.match(settingsPage, /redirect\(`\/integrations/);
  assert.doesNotMatch(inbox, /\/settings\?tab=integrations/);
  assert.match(inbox, /href: "\/integrations"/);
});

test("settings workflows use partial writes and explicit mutation permissions", () => {
  const configRoute = source("app/api/agent-config/route.ts");
  const policy = source("app/(app)/settings/PolicySettings.tsx");
  const escalation = source("app/(app)/settings/EscalationSettings.tsx");

  assert.match(configRoute, /permissions: \{ canManage \}/);
  assert.match(configRoute, /requestBody\[key\] !== undefined/);
  assert.match(configRoute, /body\.autosendEnabled === false/);
  assert.match(configRoute, /scheduled_send_at: null/);
  assert.match(configRoute, /autosendThreshold < 0\.5 \|\| autosendThreshold > 1/);
  assert.match(policy, /JSON\.stringify\(config\) !== JSON\.stringify\(baseline\)/);
  assert.match(policy, /signatureRef\.current\?\.focus\(\)/);
  assert.match(escalation, /body: JSON\.stringify\(\{ escalationDepartments: next \}\)/);
  assert.match(escalation, /department\.name\.toLowerCase\(\) === normalizedName\.toLowerCase\(\)/);
});

test("team and billing expose capacity and prevent duplicate subscriptions", () => {
  const team = source("app/api/team/members/route.ts");
  const usage = source("app/api/billing/usage/route.ts");
  const checkout = source("app/api/billing/checkout/route.ts");

  assert.match(team, /currentUserId: userId/);
  assert.match(team, /canManage: role === "admin"/);
  assert.match(team, /status:[\s\S]+"active" : "invited"/);
  assert.match(usage, /membersUsed: membersCount \?\? 0/);
  assert.match(usage, /billingPortalAvailable: Boolean\(tenant\?\.stripe_customer_id\)/);
  assert.match(checkout, /\["starter", "pro", "agency", "custom"\]\.includes\(currentPlan\)/);
  assert.match(checkout, /usePortal: true/);
});
