import { NextResponse } from "next/server";

import { registerOAuthClient } from "@/lib/mcp/oauth";
import { PUBLIC_CORS_HEADERS, parseClientRegistration } from "@/lib/mcp/oauthCore";

/**
 * RFC 7591 dynamic client registration. claude.ai and ChatGPT register
 * themselves here before the shop signs in; registering grants nothing.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

function failure(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: PUBLIC_CORS_HEADERS });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return failure("invalid_client_metadata", "Registration too large.", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return failure("invalid_client_metadata", "Body must be JSON.");
  }
  const registration = parseClientRegistration(body);
  if ("error" in registration) return failure(registration.error, registration.description);

  try {
    const client = await registerOAuthClient(registration);
    return NextResponse.json({
      client_id: client.client_id,
      client_id_issued_at: Math.floor(Date.parse(client.created_at) / 1000),
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }, { status: 201, headers: { ...PUBLIC_CORS_HEADERS, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[mcp/oauth/register]", error);
    return failure("server_error", "Registration is temporarily unavailable.", 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}
