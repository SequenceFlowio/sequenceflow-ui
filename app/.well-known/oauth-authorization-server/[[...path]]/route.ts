import { NextResponse } from "next/server";

import { requestAppOrigin } from "@/lib/brand";
import { PUBLIC_CORS_HEADERS, authorizationServerMetadata } from "@/lib/mcp/oauthCore";

/** RFC 8414: the sign-in endpoints for MCP connectors (see lib/mcp/oauthCore.ts). */

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return NextResponse.json(authorizationServerMetadata(requestAppOrigin(req.url)), {
    headers: { ...PUBLIC_CORS_HEADERS, "Cache-Control": "public, max-age=3600" },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}
