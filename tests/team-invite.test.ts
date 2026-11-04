import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("a user belongs to one workspace: the invite refuses addresses that already have one", () => {
  const invite = source("app/api/team/invite/route.ts");
  assert.match(invite, /find_user_id_by_email/);
  assert.match(invite, /heeft al een eigen Support One-workspace/);
  assert.match(invite, /status: 409/);
  // The lookup happens before Supabase sends the invitation mail.
  assert.ok(invite.indexOf("find_user_id_by_email") < invite.indexOf("inviteUserByEmail"));
  assert.match(source("supabase/migrations/067_one_workspace_per_user.sql"), /UNIQUE INDEX IF NOT EXISTS tenant_members_one_per_user/);
});

test("first login provisions a workspace through one shared path", () => {
  const callback = source("app/auth/callback/route.ts");
  assert.match(callback, /provisionTenant\(\{ userId: user\.id, name: defaultTenantName\(user\) \}\)/);
  const provision = source("lib/tenant/provision.ts");
  assert.match(provision, /plan: "trial", trial_ends_at: trialEndsAt/);
  assert.match(provision, /from\("tenant_agent_config"\)\.insert/);
  assert.match(provision, /role: "admin"/);
});
