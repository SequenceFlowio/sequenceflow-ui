import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { getQueue, listPosts, signedMediaUrls } from "@/lib/contentCalendar/db";
import { imageProviders, textProvider } from "@/lib/contentCalendar/generator";
import { publishingEnabled } from "@/lib/contentCalendar/publisher";

export const dynamic = "force-dynamic";

/**
 * Alleen lezen: beelden ophalen, de wachtrij en publiceren doet de cron (elke minuut),
 * zodat een open tabblad geen extra werk op Vercel zet.
 */
export async function GET() {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const [posts, queue] = await Promise.all([listPosts(), getQueue()]);
  // beelden, plus de video's van reels rond vandaag (om ze in de kalender te kunnen bekijken)
  const today = new Date().toISOString().slice(0, 10);
  const videos = posts.filter((p) => p.kind === "reel" && p.video?.file && !p.reel?.videoDeletedAt && p.date >= today).slice(0, 250).map((p) => p.video!.file);
  const media = await signedMediaUrls([...posts.flatMap((post) => post.image.files), ...videos]).catch(() => ({}));
  return NextResponse.json({
    posts,
    queue,
    media,
    providers: { text: textProvider(), image: imageProviders(), publishing: await publishingEnabled() },
  });
}
