import crypto from "node:crypto";

/**
 * Pure helpers for the Support One MCP server: access keys and the JSON-RPC
 * side of the Model Context Protocol (Streamable HTTP, stateless, JSON
 * responses). No network or database here, so they can be tested directly.
 */

export const MCP_TOKEN_PREFIX = "sfmcp_";
export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const MCP_SERVER_INFO = { name: "sequenceflow-support-one", title: "SequenceFlow Support One", version: "1.0.0" };
export const MCP_TOKEN_NAME_MAX = 80;

const TOKEN_PATTERN = /^sfmcp_[A-Za-z0-9_-]{43}$/;

/** A new access key; only its hash is stored, the key is shown once. */
export function newMcpToken() {
  const token = `${MCP_TOKEN_PREFIX}${crypto.randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashMcpToken(token), tokenHint: mcpTokenHint(token) };
}

export function hashMcpToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** The last four characters, so a shop can tell its keys apart. */
export function mcpTokenHint(token: string) {
  return `${MCP_TOKEN_PREFIX}…${token.slice(-4)}`;
}

export function isMcpTokenShape(value: string) {
  return TOKEN_PATTERN.test(value);
}

/** The key from `Authorization: Bearer sfmcp_…`, or null. */
export function mcpTokenFromHeader(header: string | null) {
  const match = /^bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  return match && isMcpTokenShape(match[1]) ? match[1] : null;
}

export function normalizeMcpTokenName(value: unknown) {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return name && name.length <= MCP_TOKEN_NAME_MAX ? name : null;
}

// ── JSON-RPC ────────────────────────────────────────────────────────────────

export type JsonRpcId = string | number;

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId | null; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId | null; error: { code: number; message: string } };

export const JSON_RPC = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

/** A problem the caller can fix (bad input, unknown id); its message is shown to the model. */
export class McpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolError";
  }
}

export type McpTool<Context> = {
  name: string;
  title: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
  run: (args: Record<string, unknown>, context: Context) => Promise<unknown>;
};

function rpcError(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export function negotiateProtocolVersion(requested: unknown) {
  return typeof requested === "string" && (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : MCP_PROTOCOL_VERSIONS[0];
}

function textResult(value: unknown, isError = false) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return isError ? { content: [{ type: "text", text }], isError: true } : { content: [{ type: "text", text }] };
}

/**
 * Handles one JSON-RPC message. Notifications and responses get `null`
 * (the route answers those with 202 and no body).
 */
export async function handleMcpMessage<Context>(
  message: unknown,
  tools: readonly McpTool<Context>[],
  context: Context,
  onToolError: (tool: string, error: unknown) => void = () => {},
): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return rpcError(null, JSON_RPC.invalidRequest, "Invalid request");
  }
  const request = message as Record<string, unknown>;
  const hasId = typeof request.id === "string" || typeof request.id === "number";
  const id = hasId ? request.id as JsonRpcId : null;
  if (request.jsonrpc !== "2.0") return rpcError(id, JSON_RPC.invalidRequest, "Invalid request");
  if (typeof request.method !== "string") {
    // A response from the client (we never send requests to it) or junk.
    return hasId && ("result" in request || "error" in request) ? null : rpcError(id, JSON_RPC.invalidRequest, "Invalid request");
  }
  if (!hasId) return null;

  const params = request.params && typeof request.params === "object" && !Array.isArray(request.params)
    ? request.params as Record<string, unknown>
    : {};

  switch (request.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateProtocolVersion(params.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
          instructions: "Support One handles customer support for this e-commerce shop. Use these tools to see what customers ask, how the support agent is doing, which orders, products and stock need attention, and what the shop's knowledge base says. Everything is read-only and limited to this shop.",
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: tools.map(({ name, title, description, inputSchema }) => ({
            name,
            title,
            description,
            inputSchema,
            annotations: { title, readOnlyHint: true, openWorldHint: false },
          })),
        },
      };
    case "tools/call": {
      const tool = tools.find((candidate) => candidate.name === params.name);
      if (!tool) return rpcError(id, JSON_RPC.invalidParams, `Unknown tool: ${String(params.name)}`);
      const args = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
        ? params.arguments as Record<string, unknown>
        : {};
      try {
        return { jsonrpc: "2.0", id, result: textResult(await tool.run(args, context)) };
      } catch (error) {
        if (error instanceof McpToolError) return { jsonrpc: "2.0", id, result: textResult(error.message, true) };
        onToolError(tool.name, error);
        return { jsonrpc: "2.0", id, result: textResult("This data is temporarily unavailable. Try again shortly.", true) };
      }
    }
    default:
      return rpcError(id, JSON_RPC.methodNotFound, `Method not found: ${request.method}`);
  }
}

// ── Argument readers ────────────────────────────────────────────────────────

export function readStringArg(args: Record<string, unknown>, key: string, options: { required?: boolean; max?: number } = {}) {
  const value = args[key];
  if (value === undefined || value === null || value === "") {
    if (options.required) throw new McpToolError(`"${key}" is required.`);
    return null;
  }
  if (typeof value !== "string") throw new McpToolError(`"${key}" must be text.`);
  const trimmed = value.trim();
  if (options.required && !trimmed) throw new McpToolError(`"${key}" is required.`);
  if (options.max && trimmed.length > options.max) throw new McpToolError(`"${key}" can be at most ${options.max} characters.`);
  return trimmed || null;
}

export function readIntArg(args: Record<string, unknown>, key: string, options: { min: number; max: number; fallback: number }) {
  const value = args[key];
  if (value === undefined || value === null) return options.fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new McpToolError(`"${key}" must be a whole number.`);
  return Math.min(options.max, Math.max(options.min, value));
}

export function readEnumArg<const T extends string>(args: Record<string, unknown>, key: string, allowed: readonly T[]) {
  const value = args[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new McpToolError(`"${key}" must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readUuidArg(args: Record<string, unknown>, key: string) {
  const value = readStringArg(args, key, { required: true, max: 64 })!;
  if (!UUID_PATTERN.test(value)) throw new McpToolError(`"${key}" is not a valid id.`);
  return value.toLowerCase();
}
