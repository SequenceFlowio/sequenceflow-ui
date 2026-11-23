import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { getPost } from "@/lib/contentCalendar/db";
import { mediaLinks } from "@/lib/contentCalendar/mediaServer";

export const dynamic = "force-dynamic";

/**
 * Link voor één video (en cover), pas opgehaald als je een reel opent: de kalender zelf laadt alleen thumbnails.
 * Video's van nieuwe reels staan op de Hetzner-server; die link komt dan van daar (mediaServer.ts).
 */
export async function GET(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const files = new URL(request.url).searchParams.getAll("file").filter((f) => /^[\w.-]+$/.test(f)).slice(0, 4);
  if (!files.length) return NextResponse.json({ error: "Geen bestand" }, { status: 400 });
  return NextResponse.json({ media: await mediaLinks(files, async (id) => (await getPost(id))?.video?.store) });
}
