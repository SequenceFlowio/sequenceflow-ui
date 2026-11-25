import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { getPost } from "@/lib/contentCalendar/db";
import { retryTikTokNow } from "@/lib/contentCalendar/publisher";

export const maxDuration = 300;

/** Mislukte TikTok-poging van een geplaatste post meteen opnieuw versturen. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: "Post niet gevonden" }, { status: 404 });
  try {
    return NextResponse.json({ post: await retryTikTokNow(post) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mislukt" }, { status: 400 });
  }
}
