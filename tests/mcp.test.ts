import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  JSON_RPC,
  McpToolError,
  handleMcpMessage,
  hashMcpToken,
  isMcpTokenShape,
  mcpTokenFromHeader,
  negotiateProtocolVersion,
  newMcpToken,
  normalizeMcpTokenName,
  readIntArg,
  readUuidArg,
  type McpTool,
} from "../lib/mcp/core.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

type Caller = { tenantId: string };
const caller: Caller = { tenantId: "tenant-a" };
const tools: McpTool<Caller>[] = [
  {
    name: "echo_tenant",
    title: "Echo",
    description: "Returns the caller's tenant.",
    inputSchema: { type: "object", properties: {} },
    run: async (_args, context) => ({ tenantId: context.tenantId }),
  },
  {
    name: "fails",
    title: "Fails",
    description: "Always fails.",
    inputSchema: { type: "object", properties: {} },
    run: async (args) => {
      if (args.userError) throw new McpToolError("Bad input.");
      throw new Error("database password in stack trace");
    },
  },
];

test("access keys are random, recognisable and only stored as a hash", () => {
  const first = newMcpToken();
  const second = newMcpToken();
  assert.notEqual(first.token, second.token);
  assert.ok(isMcpTokenShape(first.token));
  assert.equal(first.tokenHash, hashMcpToken(first.token));
  assert.equal(first.tokenHash.length, 64);
  assert.ok(!first.tokenHash.includes(first.token));
  assert.equal(first.tokenHint, `sfmcp_…${first.token.slice(-4)}`);
});

test("only a well-formed bearer key is accepted from the header", () => {
  const { token } = newMcpToken();
  assert.equal(mcpTokenFromHeader(`Bearer ${token}`), token);
  assert.equal(mcpTokenFromHeader(`bearer ${token}`), token);
  assert.equal(mcpTokenFromHeader(token), null);
  assert.equal(mcpTokenFromHeader("Bearer eyJhbGciOiJIUzI1NiJ9.supabase.jwt"), null);
  assert.equal(mcpTokenFromHeader(null), null);
});

test("key names are trimmed and bounded", () => {
  assert.equal(normalizeMcpTokenName("  Claude   van  Ezra "), "Claude van Ezra");
  assert.equal(normalizeMcpTokenName(""), null);
  assert.equal(normalizeMcpTokenName("x".repeat(81)), null);
  assert.equal(normalizeMcpTokenName(42), null);
});

test("initialize negotiates a supported protocol version", async () => {
  const response = await handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, tools, caller);
  assert.ok(response && "result" in response);
  const result = response.result as { protocolVersion: string; capabilities: { tools: unknown }; serverInfo: { name: string } };
  assert.equal(result.protocolVersion, "2025-03-26");
  assert.ok(result.capabilities.tools);
  assert.equal(result.serverInfo.name, "sequenceflow-support-one");
  assert.equal(negotiateProtocolVersion("1999-01-01"), "2025-06-18");
});

test("notifications and client responses get no reply", async () => {
  assert.equal(await handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, tools, caller), null);
  assert.equal(await handleMcpMessage({ jsonrpc: "2.0", id: 9, result: {} }, tools, caller), null);
});

test("tools are listed as read-only", async () => {
  const response = await handleMcpMessage({ jsonrpc: "2.0", id: "a", method: "tools/list" }, tools, caller);
  assert.ok(response && "result" in response);
  const listed = (response.result as { tools: Array<{ name: string; annotations: { readOnlyHint: boolean } }> }).tools;
  assert.deepEqual(listed.map((tool) => tool.name), ["echo_tenant", "fails"]);
  assert.ok(listed.every((tool) => tool.annotations.readOnlyHint));
});

test("a tool call runs with the caller's tenant", async () => {
  const response = await handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "echo_tenant", arguments: {} } }, tools, caller);
  assert.ok(response && "result" in response);
  const result = response.result as { content: Array<{ text: string }>; isError?: boolean };
  assert.equal(result.isError, undefined);
  assert.deepEqual(JSON.parse(result.content[0].text), { tenantId: "tenant-a" });
});

test("tool failures never leak internals, user errors are explained", async () => {
  const logged: string[] = [];
  const internal = await handleMcpMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "fails", arguments: {} } }, tools, caller, (tool) => logged.push(tool));
  assert.ok(internal && "result" in internal);
  const internalResult = internal.result as { content: Array<{ text: string }>; isError: boolean };
  assert.equal(internalResult.isError, true);
  assert.doesNotMatch(internalResult.content[0].text, /password/);
  assert.deepEqual(logged, ["fails"]);

  const user = await handleMcpMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "fails", arguments: { userError: true } } }, tools, caller);
  assert.ok(user && "result" in user);
  assert.equal((user.result as { content: Array<{ text: string }> }).content[0].text, "Bad input.");
});

test("unknown tools, methods and malformed requests are JSON-RPC errors", async () => {
  const unknownTool = await handleMcpMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } }, tools, caller);
  assert.ok(unknownTool && "error" in unknownTool);
  assert.equal(unknownTool.error.code, JSON_RPC.invalidParams);

  const unknownMethod = await handleMcpMessage({ jsonrpc: "2.0", id: 6, method: "resources/list" }, tools, caller);
  assert.ok(unknownMethod && "error" in unknownMethod);
  assert.equal(unknownMethod.error.code, JSON_RPC.methodNotFound);

  const malformed = await handleMcpMessage({ id: 7, method: "ping" }, tools, caller);
  assert.ok(malformed && "error" in malformed);
  assert.equal(malformed.error.code, JSON_RPC.invalidRequest);
});

test("argument readers reject bad input instead of querying with it", () => {
  assert.equal(readIntArg({ limit: 500 }, "limit", { min: 1, max: 50, fallback: 20 }), 50);
  assert.equal(readIntArg({}, "limit", { min: 1, max: 50, fallback: 20 }), 20);
  assert.throws(() => readIntArg({ limit: "5" }, "limit", { min: 1, max: 50, fallback: 20 }), McpToolError);
  assert.equal(readUuidArg({ id: "6F1C2B4E-0A1B-4C2D-8E3F-123456789ABC" }, "id"), "6f1c2b4e-0a1b-4c2d-8e3f-123456789abc");
  assert.throws(() => readUuidArg({ id: "1 OR 1=1" }, "id"), McpToolError);
});

test("every MCP query is scoped to the caller's tenant and keys stay server-side", () => {
  const tools = source("lib/mcp/tools.ts");
  const fromCalls = tools.match(/\.from\("[a-z_]+"\)/g) ?? [];
  const tenantFilters = tools.match(/\.eq\("tenant_id", caller\.tenantId\)/g) ?? [];
  assert.ok(fromCalls.length > 0);
  assert.equal(tenantFilters.length, fromCalls.length);

  const migration = source("supabase/migrations/056_mcp_access_tokens.sql");
  assert.match(migration, /ALTER TABLE mcp_access_tokens ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON mcp_access_tokens FROM anon, authenticated/);
  assert.match(migration, /token_hash text NOT NULL UNIQUE/);
  assert.doesNotMatch(migration, /\btoken text\b/);
});
