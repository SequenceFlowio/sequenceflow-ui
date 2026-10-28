import { NextResponse } from "next/server";

import { requestAppOrigin } from "@/lib/brand";
import { PUBLIC_CORS_HEADERS, protectedResourceMetadata } from "@/lib/mcp/oauthCore";

/**
 * RFC 9728: tells MCP clients (claude.ai, ChatGPT) where to sign in for
 * /api/mcp. Served at the root and at /.well-known/oauth-protected-resource/api/mcp.
 */

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return NextResponse.json(protectedResourceMetadata(requestAppOrigin(req.url)), {
    headers: { ...PUBLIC_CORS_HEADERS, "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}
