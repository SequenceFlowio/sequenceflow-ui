import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "email",
  "profile",
];

// ─── GET /api/integrations/google/start ────────────────────────────────────
// Verifies the authenticated user, resolves their tenant, and redirects them
// to the Google OAuth consent screen. Token exchange happens in the callback.

export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: any) {
    if (err.message === "Not authenticated") {
      return NextResponse.redirect(new URL("/login?next=" + encodeURIComponent("/inbox"), req.url));
    }
    return NextResponse.json({ error: err.message }, { status: 403 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("[google/start] GOOGLE_CLIENT_ID is not set");
    return NextResponse.json({ error: "OAuth not configured" }, { status: 500 });
  }

  const state = Buffer.from(JSON.stringify({ tenant_id: tenantId })).toString("base64url");

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://supportflow.sequenceflow.io") + "/api/integrations/google/callback",
    scope:         SCOPES.join(" "),
    response_type: "code",
    access_type:   "offline",
    prompt:        "consent",
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
