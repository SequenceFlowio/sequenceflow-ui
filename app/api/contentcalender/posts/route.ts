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
  // alleen de gekozen foto per post (thumbnail); video's krijgen pas een link als je de reel opent
  const thumbs = posts.flatMap((post) => post.image.files[post.image.selected] ?? []);
  const media = await signedMediaUrls(thumbs).catch(() => ({}));
  return NextResponse.json({
    posts,
    queue,
    media,
    providers: { text: textProvider(), image: imageProviders(), publishing: await publishingEnabled() },
  });
}
