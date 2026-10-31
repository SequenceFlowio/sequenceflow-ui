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
  const media = await signedMediaUrls(posts.flatMap((post) => post.image.files)).catch(() => ({}));
  return NextResponse.json({
    posts,
    queue,
    media,
    providers: { text: textProvider(), image: imageProviders(), publishing: publishingEnabled() },
  });
}
