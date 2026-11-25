import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { refreshRecentMetrics } from "@/lib/contentCalendar/insights";
import { syncTikTokStatuses } from "@/lib/contentCalendar/publisher";
import { parseLocale } from "@/lib/contentCalendar/locale";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Knop "Cijfers verversen": de laatste stand van recente posts ophalen bij Meta (per taal), plus de TikTok-stand. */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  try {
    const { locale } = await request.json().catch(() => ({}));
    const tiktok = await syncTikTokStatuses().catch((error) => ({ error: String(error) }));
    return NextResponse.json({ ...(await refreshRecentMetrics(parseLocale(locale))), tiktok });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cijfers ophalen mislukt" }, { status: 500 });
  }
}
