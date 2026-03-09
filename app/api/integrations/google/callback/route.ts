import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TOKEN_URL    = "https://oauth2.googleapis.com/token";
const REDIRECT_URI = "https://emailreply.sequenceflow.io/api/integrations/google/callback";

// ─── GET /api/integrations/google/callback ─────────────────────────────────
// Receives the OAuth callback from Google, exchanges the code for tokens,
// and persists them in tenant_integrations.

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // ── Google-side error (user denied consent, etc.) ─────────────────────────
  if (error) {
    console.error("[google/callback] Google returned error:", error);
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=access_denied", req.nextUrl.origin));
  }

  if (!code || !state) {
    console.error("[google/callback] Missing code or state");
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=invalid_callback", req.nextUrl.origin));
  }

  // ── Decode state → tenant_id ──────────────────────────────────────────────
  let tenantId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    tenantId = decoded.tenant_id;
    if (!tenantId) throw new Error("tenant_id missing from state");
  } catch (err) {
    console.error("[google/callback] Failed to decode state:", err);
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=invalid_state", req.nextUrl.origin));
  }

  // ── Exchange code for tokens ───────────────────────────────────────────────
  let accessToken:  string;
  let refreshToken: string;
  let expiresAt:    string;

  try {
    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set");
    }

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
    }

    const tokens = await tokenRes.json();

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error(`Incomplete token response: ${JSON.stringify(tokens)}`);
    }

    accessToken  = tokens.access_token;
    refreshToken = tokens.refresh_token;
    expiresAt    = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  } catch (err) {
    console.error("[google/callback] Token exchange error:", err);
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=token_exchange_failed", req.nextUrl.origin));
  }

  // ── Persist tokens in tenant_integrations ─────────────────────────────────
  try {
    const supabase = getSupabaseAdmin();

    const { error: dbError } = await supabase
      .from("tenant_integrations")
      .upsert(
        {
          tenant_id:    tenantId,
          provider:     "gmail",
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at:   expiresAt,
          created_at:   new Date().toISOString(),
        },
        { onConflict: "tenant_id,provider" }
      );

    if (dbError) {
      throw new Error(dbError.message);
    }

    console.log("[google/callback] Tokens stored for tenant:", tenantId);
  } catch (err) {
    console.error("[google/callback] DB upsert error:", err);
    return NextResponse.redirect(new URL("/settings?tab=integrations&error=db_error", req.nextUrl.origin));
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return NextResponse.redirect(new URL("/settings?tab=integrations&connected=gmail", req.nextUrl.origin));
}
