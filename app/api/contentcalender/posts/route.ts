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
  const t0 = Date.now();
  const [posts, queue, publishing] = await Promise.all([listPosts(), getQueue(), publishingEnabled()]);
  const t1 = Date.now();
  // alleen de gekozen foto per post (thumbnail); video's krijgen pas een link als je de reel opent
  const thumbs = posts.flatMap((post) => post.image.files[post.image.selected] ?? []);
  const media = await signedMediaUrls(thumbs).catch(() => ({}));
  const t2 = Date.now();
  return NextResponse.json(
    { posts, queue, media, providers: { text: textProvider(), image: imageProviders(), publishing } },
    { headers: { "Server-Timing": `db;dur=${t1 - t0}, sign;dur=${t2 - t1}` } },
  );
}
