import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { refreshTikTokCreator, updateTikTokSettings, type TikTokSettings } from "@/lib/contentCalendar/tiktok";
import { parseLocale } from "@/lib/contentCalendar/locale";

/** Instellingen voor TikTok: inbox of direct, zichtbaarheid, reacties/duet/stitch, automatische muziek. */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  try {
    const body = (await request.json()) as Partial<TikTokSettings> & { refresh?: boolean; locale?: string };
    const locale = parseLocale(body.locale);
    if (body.refresh) await refreshTikTokCreator(locale);
    const patch: Partial<TikTokSettings> = {};
    if (body.mode === "inbox" || body.mode === "direct") patch.mode = body.mode;
    if (typeof body.privacyLevel === "string") patch.privacyLevel = body.privacyLevel;
    for (const key of ["allowComment", "allowDuet", "allowStitch", "autoAddMusic"] as const) if (typeof body[key] === "boolean") patch[key] = body[key];
    return NextResponse.json({ settings: await updateTikTokSettings(patch, locale) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Opslaan mislukt" }, { status: 400 });
  }
}
