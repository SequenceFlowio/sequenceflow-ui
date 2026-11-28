import { NextResponse } from "next/server";

import { hasValidCronSecret, unauthorizedCron } from "@/lib/auth/cron";
import { sendMorningBrief } from "@/lib/marketing/morningBrief";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Elke werkdag om 07:30 Nederlandse wintertijd (vercel.json, 06:30 UTC): de ochtendbrief
 * aan de beheerders. Eén keer per dag; een handmatige proef kan met x-cron-secret en ?force=1.
 * Zet opvolgconcepten klaar maar verstuurt niets naar klanten of leads, en past geen advertenties aan.
 */
export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) return unauthorizedCron();
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const result = await sendMorningBrief({ force });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/morning-brief]", error instanceof Error ? error.message : error);
    return NextResponse.json({ sent: false, error: "Ochtendbrief mislukt" }, { status: 500 });
  }
}
