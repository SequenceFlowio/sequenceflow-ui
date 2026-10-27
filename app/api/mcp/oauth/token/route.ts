import { NextResponse } from "next/server";

import { OAuthTokenError, exchangeAuthorizationCode, refreshAccessToken } from "@/lib/mcp/oauth";
import { PUBLIC_CORS_HEADERS } from "@/lib/mcp/oauthCore";

/** OAuth token endpoint for MCP connectors: authorization_code (PKCE) and refresh_token. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { ...PUBLIC_CORS_HEADERS, "Cache-Control": "no-store", Pragma: "no-cache" };

function failure(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: NO_STORE });
}

async function readParams(req: Request): Promise<Record<string, string>> {
  const raw = await req.text();
  if (raw.length > 16 * 1024) return {};
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const body = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(body).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

export async function POST(req: Request) {
  const params = await readParams(req);
  const clientId = params.client_id ?? "";
  if (!clientId) return failure("invalid_client", "client_id is required.", 401);

  try {
    if (params.grant_type === "authorization_code") {
      if (!params.code || !params.redirect_uri || !params.code_verifier) {
        return failure("invalid_request", "code, redirect_uri and code_verifier are required.");
      }
      return NextResponse.json(await exchangeAuthorizationCode({
        code: params.code,
        clientId,
        redirectUri: params.redirect_uri,
        codeVerifier: params.code_verifier,
      }), { headers: NO_STORE });
    }
    if (params.grant_type === "refresh_token") {
      if (!params.refresh_token) return failure("invalid_request", "refresh_token is required.");
      return NextResponse.json(await refreshAccessToken({ refreshToken: params.refresh_token, clientId }), { headers: NO_STORE });
    }
    return failure("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch (error) {
    if (error instanceof OAuthTokenError) return failure(error.error, error.message, error.error === "invalid_client" ? 401 : 400);
    console.error("[mcp/oauth/token]", error);
    return failure("server_error", "Sign-in is temporarily unavailable.", 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}
