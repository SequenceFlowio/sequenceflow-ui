import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ─── GET /api/integrations/gmail/active ────────────────────────────────────
// Called by n8n every minute to fetch all active Gmail integrations.
// Refreshes expired tokens before returning.

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  // Fetch all connected Gmail integrations
  const { data, error } = await supabase
    .from("tenant_integrations")
    .select("tenant_id, account_email, access_token, refresh_token, expires_at")
    .eq("provider", "gmail")
    .eq("status", "connected");

  if (error) {
    console.error("[gmail/active] DB fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json([]);
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const now = Date.now();
  const results = [];

  for (const row of data) {
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    const isExpired = expiresAt <= now;

    if (!isExpired) {
      results.push({
        tenant_id:     row.tenant_id,
        account_email: row.account_email,
        access_token:  row.access_token,
        refresh_token: row.refresh_token,
        expires_at:    row.expires_at,
      });
      continue;
    }

    // Token expired — refresh it
    if (!clientId || !clientSecret) {
      console.error("[gmail/active] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      // Still return the integration with the stale token rather than omitting it
      results.push({
        tenant_id:     row.tenant_id,
        account_email: row.account_email,
        access_token:  row.access_token,
        refresh_token: row.refresh_token,
        expires_at:    row.expires_at,
      });
      continue;
    }

    try {
      const tokenRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "refresh_token",
          refresh_token: row.refresh_token,
          client_id:     clientId,
          client_secret: clientSecret,
        }),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        throw new Error(`Token refresh failed (${tokenRes.status}): ${body}`);
      }

      const tokens = await tokenRes.json();

      if (!tokens.access_token) {
        throw new Error("No access_token in refresh response");
      }

      const newAccessToken = tokens.access_token;
      const newExpiresAt   = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Persist the refreshed token
      const { error: updateError } = await supabase
        .from("tenant_integrations")
        .update({
          access_token: newAccessToken,
          expires_at:   newExpiresAt,
          updated_at:   new Date().toISOString(),
        })
        .eq("tenant_id", row.tenant_id)
        .eq("provider", "gmail");

      if (updateError) {
        console.error(`[gmail/active] Failed to update token for tenant ${row.tenant_id}:`, updateError);
      } else {
        console.log(`[gmail/active] Refreshed token for tenant ${row.tenant_id}`);
      }

      results.push({
        tenant_id:     row.tenant_id,
        account_email: row.account_email,
        access_token:  newAccessToken,
        refresh_token: row.refresh_token,
        expires_at:    newExpiresAt,
      });
    } catch (err) {
      // Log without exposing the refresh token value
      console.error(`[gmail/active] Token refresh error for tenant ${row.tenant_id}:`, err);
      // Skip this integration so n8n doesn't attempt to use a stale token
    }
  }

  return NextResponse.json(results);
}
