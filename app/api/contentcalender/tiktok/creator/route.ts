import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { parseLocale } from "@/lib/contentCalendar/locale";
import { tiktokCreator } from "@/lib/contentCalendar/tiktok";

export const dynamic = "force-dynamic";

/** Gegevens van de gekoppelde TikTok-maker (nickname, zichtbaarheidsopties, uitgeschakelde interacties), live opgevraagd. */
export async function GET(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  try {
    const creator = await tiktokCreator(parseLocale(new URL(request.url).searchParams.get("locale")));
    return NextResponse.json({ creator });
  } catch (error) {
    return NextResponse.json({ creator: null, error: error instanceof Error ? error.message : "TikTok niet bereikbaar" }, { status: 200 });
  }
}
