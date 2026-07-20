import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthorizationError,
  hasValidInternalSecret,
  requireRole,
  resolveTenantScope,
} from "../lib/auth/authorization.ts";

const context = { tenantId: "tenant-a", role: "admin", userId: "user-a" };

test("tenant scope always stays bound to an authenticated tenant", () => {
  assert.equal(resolveTenantScope(context), "tenant-a");
  assert.equal(resolveTenantScope(context, "tenant-a"), "tenant-a");
  assert.throws(
    () => resolveTenantScope(context, "tenant-b"),
    (error) => error instanceof AuthorizationError && error.status === 403
  );
});

test("only explicitly authorized internal requests may override tenant scope", () => {
  assert.equal(
    resolveTenantScope(context, "tenant-b", { allowOverride: true }),
    "tenant-b"
  );
});

test("role checks reject non-admin callers", () => {
  assert.throws(
    () => requireRole({ ...context, role: "agent" }, ["admin"]),
    (error) => error instanceof AuthorizationError && error.status === 403
  );
});

test("internal secret comparison fails closed", () => {
  assert.equal(hasValidInternalSecret(new Request("https://example.test"), "secret"), false);
  assert.equal(
    hasValidInternalSecret(
      new Request("https://example.test", { headers: { "x-internal-secret": "wrong" } }),
      "secret"
    ),
    false
  );
  assert.equal(
    hasValidInternalSecret(
      new Request("https://example.test", { headers: { "x-internal-secret": "secret" } }),
      "secret"
    ),
    true
  );
});
