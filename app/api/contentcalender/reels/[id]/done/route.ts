import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { mediaServerConfigured } from "@/lib/contentCalendar/mediaServer";
import { finishReel } from "@/lib/contentCalendar/reels";

/** Video en cover staan klaar (video in de opslag of, met store "server", op de Hetzner-server): de reel is klaar om te posten. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  const { seconds, store } = await request.json().catch(() => ({}));
  const onServer = store === "server" && mediaServerConfigured();
  const post = await finishReel(id, Number(seconds) || 0, onServer ? "server" : undefined);
  return NextResponse.json({ ok: true, status: post.reel?.status });
}
