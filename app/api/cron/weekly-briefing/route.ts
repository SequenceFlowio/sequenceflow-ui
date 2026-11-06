import { NextResponse } from "next/server";

import { hasValidCronSecret } from "@/lib/auth/cron";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { weekKey } from "@/lib/support/weeklyBriefing";
import { sendWeeklyBriefing } from "@/lib/support/weeklyBriefingSender";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Maandagochtend: de wekelijkse mail aan elke actieve werkruimte die hem niet heeft uitgezet. */
export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const week = weekKey(now);
  const { data: tenants, error } = await getSupabaseAdmin()
    .from("tenants")
    .select("id")
    .in("plan", ["trial", "starter", "pro", "agency", "custom"])
    .eq("weekly_briefing_enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  const failures: string[] = [];
  for (const tenant of tenants ?? []) {
    try {
      const result = await sendWeeklyBriefing(tenant.id, week, now);
      counts[result.status] = (counts[result.status] ?? 0) + 1;
    } catch (err) {
      failures.push(`${tenant.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (failures.length) console.error("[cron/weekly-briefing]", failures);
  return NextResponse.json({ week, ...counts, failures: failures.length });
}
