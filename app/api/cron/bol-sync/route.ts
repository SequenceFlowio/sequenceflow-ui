import { NextResponse } from "next/server";

import { syncBolContext, syncBolSubscriptionHealth } from "@/lib/commerce/bol";
import { mapCommerceConnection } from "@/lib/commerce/connections";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await getSupabaseAdmin().from("commerce_connections")
    .select("*").eq("provider", "bol").eq("status", "active").limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results = [];
  for (const row of data ?? []) {
    const connection = mapCommerceConnection(row);
    try {
      const events = await syncBolSubscriptionHealth(connection);
      const returnsAreDue = !connection.lastReturnsSyncedAt
        || Date.now() - Date.parse(connection.lastReturnsSyncedAt) >= 15 * 60_000;
      results.push({
        connectionId: connection.id,
        ok: true,
        events,
        ...(await syncBolContext(connection, 12, returnsAreDue)),
        returnsSkipped: !returnsAreDue,
      });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "bol.com sync failed.";
      await getSupabaseAdmin().from("commerce_connections").update({
        last_error: message.slice(0, 1000), updated_at: new Date().toISOString(),
      }).eq("id", connection.id);
      results.push({ connectionId: connection.id, ok: false, error: message });
    }
  }
  return NextResponse.json({ ok: true, results });
}
