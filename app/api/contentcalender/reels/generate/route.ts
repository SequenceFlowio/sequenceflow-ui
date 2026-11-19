import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { isLocale } from "@/lib/contentCalendar/locale";
import { generateReels } from "@/lib/contentCalendar/reels";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Reel-concepten maken voor een taal: { locale, from: "yyyy-MM-dd", days, max? }. */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if (!isLocale(body.locale) || !/^\d{4}-\d{2}-\d{2}$/.test(body.from ?? "")) return NextResponse.json({ error: "Kies een taal en startdatum" }, { status: 400 });
  const days = Math.min(14, Math.max(1, Number(body.days) || 1));
  try {
    return NextResponse.json(await generateReels({ locale: body.locale, from: body.from, days, max: Math.min(28, Number(body.max) || 28) }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Genereren mislukt" }, { status: 500 });
  }
}
