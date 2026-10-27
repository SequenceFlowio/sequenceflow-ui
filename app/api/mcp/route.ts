import { NextResponse } from "next/server";

import { getTenantPlanAccess } from "@/lib/billing";
import { requestAppOrigin } from "@/lib/brand";
import {
  JSON_RPC,
  MCP_PROTOCOL_VERSIONS,
  handleMcpMessage,
  mcpTokenFromHeader,
} from "@/lib/mcp/core";
import { PUBLIC_CORS_HEADERS, protectedResourceMetadataUrl } from "@/lib/mcp/oauthCore";
import { authenticateMcpToken } from "@/lib/mcp/tokens";
import { MCP_TOOLS } from "@/lib/mcp/tools";

/**
 * Support One as a remote MCP server (Streamable HTTP, stateless, JSON
 * responses). Clients authenticate with `Authorization: Bearer sfmcp_…`:
 * a key the shop creates under Koppelingen, or an OAuth access token from
 * signing in through a connector (claude.ai, ChatGPT; see lib/mcp/oauth.ts).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

function rpcFailure(status: number, code: number, message: string, headers: Record<string, string> = {}) {
  return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: { ...PUBLIC_CORS_HEADERS, ...headers } });
}

export async function POST(req: Request) {
  const version = req.headers.get("mcp-protocol-version");
  if (version && !(MCP_PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
    return rpcFailure(400, JSON_RPC.invalidRequest, `Unsupported MCP protocol version: ${version}`);
  }

  const token = mcpTokenFromHeader(req.headers.get("authorization"));
  const caller = token ? await authenticateMcpToken(token).catch((error) => {
    console.error("[mcp] token lookup failed", error);
    return undefined;
  }) : null;
  if (caller === undefined) return rpcFailure(503, JSON_RPC.internalError, "Temporarily unavailable. Try again shortly.");
  if (!caller) {
    // Points connectors to the sign-in flow (RFC 9728).
    const metadata = protectedResourceMetadataUrl(requestAppOrigin(req.url));
    return rpcFailure(401, JSON_RPC.invalidRequest, "Missing, invalid or expired access token. Sign in again or create a key in Support One under Koppelingen.", {
      "WWW-Authenticate": `Bearer realm="Support One", resource_metadata="${metadata}"`,
    });
  }

  const { plan } = await getTenantPlanAccess(caller.tenantId);
  if (plan === "expired") return rpcFailure(403, JSON_RPC.invalidRequest, "This Support One account has expired.");

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return rpcFailure(413, JSON_RPC.invalidRequest, "Request too large.");
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return rpcFailure(413, JSON_RPC.invalidRequest, "Request too large.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return rpcFailure(400, JSON_RPC.parseError, "Parse error");
  }

  const onToolError = (tool: string, error: unknown) => console.error(`[mcp] ${tool} failed for tenant ${caller.tenantId}`, error);
  const messages = Array.isArray(body) ? body : [body];
  if (!messages.length) return rpcFailure(400, JSON_RPC.invalidRequest, "Invalid request");
  const responses = (await Promise.all(messages.map((message) => handleMcpMessage(message, MCP_TOOLS, caller, onToolError))))
    .filter((response) => response !== null);

  if (!responses.length) return new Response(null, { status: 202, headers: PUBLIC_CORS_HEADERS });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0], { headers: PUBLIC_CORS_HEADERS });
}

// Stateless server: no server-initiated stream and no sessions to end.
function methodNotAllowed() {
  return new Response(null, { status: 405, headers: { ...PUBLIC_CORS_HEADERS, Allow: "POST" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
