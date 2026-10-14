import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// Every page view and API request runs these; each extra round-trip to
// Supabase is paid for in function time on Vercel, around the clock.

test("sign-in checks read the token locally instead of asking the Auth server", () => {
  for (const path of ["proxy.ts", "app/(app)/layout.tsx", "lib/tenant.ts"]) {
    const contents = source(path);
    assert.match(contents, /readSessionClaims\(/, path);
    assert.doesNotMatch(contents, /auth\.getUser\(/, path);
  }
});

test("the workspace and plan gate runs once per page view, in the app layout", () => {
  const layout = source("app/(app)/layout.tsx");
  assert.match(layout, /redirectTo: "\/upgrade"/);
  assert.match(layout, /if \("redirectTo" in workspace\) redirect\(workspace\.redirectTo\)/);
  assert.match(layout, /from\("tenants"\)/);
  const proxy = source("proxy.ts");
  assert.doesNotMatch(proxy, /from\("tenant_members"\)/);
  assert.doesNotMatch(proxy, /from\("tenants"\)/);
});

test("the ticket list brings one inbound message per conversation, not all of them", () => {
  const route = source("app/api/tickets/route.ts");
  assert.match(route, /limit\(1, \{ referencedTable: "support_messages" \}\)/);
  assert.doesNotMatch(route, /from\("support_messages"\)/);
});
