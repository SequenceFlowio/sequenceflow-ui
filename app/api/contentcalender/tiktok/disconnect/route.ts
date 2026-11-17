import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { disconnectTikTok } from "@/lib/contentCalendar/tiktok";

/** Ontkoppelen: token intrekken bij TikTok en wissen. */
export async function POST() {
  const denied = await requireContentAccess();
  if (denied) return denied;
  await disconnectTikTok();
  return NextResponse.json({ ok: true });
}
