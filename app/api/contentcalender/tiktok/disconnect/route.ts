import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { disconnectTikTok } from "@/lib/contentCalendar/tiktok";
import { parseLocale } from "@/lib/contentCalendar/locale";

/** Ontkoppelen: token intrekken bij TikTok en wissen. */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { locale } = await request.json().catch(() => ({}));
  await disconnectTikTok(parseLocale(locale));
  return NextResponse.json({ ok: true });
}
