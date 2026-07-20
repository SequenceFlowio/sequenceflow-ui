import { NextResponse } from "next/server";

import { failCommerceEvent, processCommerceEvent, type CommerceEventWorkItem } from "@/lib/commerce/events";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  return Boolean(process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedLimit = Number(new URL(req.url).searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(requestedLimit) ? Math.max(0, Math.min(100, Math.floor(requestedLimit))) : 20;
  const { data, error } = await getSupabaseAdmin().rpc("claim_commerce_events", { p_limit: limit });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const events = (data ?? []) as CommerceEventWorkItem[];
  let processed = 0;
  let failed = 0;
  for (const event of events) {
    try {
      await processCommerceEvent(event);
      processed += 1;
    } catch (processingError) {
      try {
        await failCommerceEvent(event, processingError);
      } catch (failureError) {
        console.error("[commerce-event-worker/failure-state]", event.id, failureError);
      }
      failed += 1;
    }
  }
  return NextResponse.json({ ok: true, claimed: events.length, processed, failed });
}
