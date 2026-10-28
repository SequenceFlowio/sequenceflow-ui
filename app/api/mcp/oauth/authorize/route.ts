import { NextResponse } from "next/server";

import { requestAppOrigin } from "@/lib/brand";
import { createAuthorizationCode, loadOAuthClient } from "@/lib/mcp/oauth";
import { redirectWithParams, validateAuthorizationRequest } from "@/lib/mcp/oauthCore";
import { getTenantId } from "@/lib/tenant";

/**
 * The shop's answer on the consent page (/oauth/authorize). Only a signed-in
 * admin, posting from our own page, can approve an app.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function plainError(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(req: Request) {
  const origin = requestAppOrigin(req.url);
  const sentFrom = req.headers.get("origin");
  if (!sentFrom || sentFrom !== new URL(req.url).origin) return plainError("Forbidden", 403);

  const form = await req.formData().catch(() => null);
  if (!form) return plainError("Bad request", 400);
  const params = Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"));

  const client = await loadOAuthClient(params.client_id ?? "").catch(() => null);
  const request = validateAuthorizationRequest(params, client, origin);
  if ("error" in request) {
    if (!request.redirectable) return plainError(request.description, 400);
    return NextResponse.redirect(redirectWithParams(params.redirect_uri!, {
      error: request.error, error_description: request.description, state: params.state ?? null,
    }), 303);
  }

  if (params.decision !== "allow") {
    return NextResponse.redirect(redirectWithParams(request.redirectUri, {
      error: "access_denied", error_description: "The shop declined access.", state: request.state,
    }), 303);
  }

  let context: Awaited<ReturnType<typeof getTenantId>>;
  try {
    context = await getTenantId(req);
  } catch {
    return plainError("Not signed in", 401);
  }
  if (context.role !== "admin") return plainError("Only an admin can connect apps.", 403);

  try {
    const code = await createAuthorizationCode({
      clientId: request.clientId,
      tenantId: context.tenantId,
      userId: context.userId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
    });
    return NextResponse.redirect(redirectWithParams(request.redirectUri, { code, state: request.state, iss: origin }), 303);
  } catch (error) {
    console.error("[mcp/oauth/authorize]", error);
    return NextResponse.redirect(redirectWithParams(request.redirectUri, {
      error: "server_error", error_description: "Sign-in is temporarily unavailable.", state: request.state,
    }), 303);
  }
}
