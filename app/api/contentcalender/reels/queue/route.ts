import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { listPosts, signedMediaUrls } from "@/lib/contentCalendar/db";
import { renderable } from "@/lib/contentCalendar/reels";

export const dynamic = "force-dynamic";

/** Voor de reel-worker: welke reels nu gemaakt kunnen worden (met een link naar het beeld, als die er is). */
export async function GET() {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const items = renderable(await listPosts()).slice(0, 6);
  const images = await signedMediaUrls(items.flatMap((p) => p.image.files.slice(p.image.selected, p.image.selected + 1))).catch(() => ({} as Record<string, string>));
  return NextResponse.json({
    reels: items.map((p) => ({ id: p.id, date: p.date, time: p.time, locale: p.locale ?? "nl", reel: p.reel, image: images[p.image.files[p.image.selected]] ?? null })),
  });
}
