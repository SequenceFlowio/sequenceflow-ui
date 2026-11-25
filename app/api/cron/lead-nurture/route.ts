import { NextResponse } from "next/server";

import { hasValidCronSecret } from "@/lib/auth/cron";
import { runLeadNurture } from "@/lib/marketing/leads";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Elke ochtend: de volgende tip-mail aan wie een gratis download ophaalde en om tips vroeg (pas met LEAD_NURTURE_ENABLED=1). */
export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runLeadNurture());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
