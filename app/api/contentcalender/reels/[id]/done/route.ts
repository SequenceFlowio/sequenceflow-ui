import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { finishReel } from "@/lib/contentCalendar/reels";

/** Video en cover staan in de opslag: de reel is klaar om te posten. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  const { seconds } = await request.json().catch(() => ({}));
  const post = await finishReel(id, Number(seconds) || 0);
  return NextResponse.json({ ok: true, status: post.reel?.status });
}
