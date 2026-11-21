import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { updatePost } from "@/lib/contentCalendar/db";
import type { PostYouTube } from "@/lib/contentCalendar/types";

const STATUSES = ["scheduled", "published", "paused", "failed"] as const;

/** De reel-server meldt hier de YouTube-status van een reel (ingepland, geplaatst, gepauzeerd of mislukt). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Onbekende status" }, { status: 400 });
  const youtube: PostYouTube = {
    status: body.status,
    at: new Date().toISOString(),
    ...(typeof body.id === "string" && /^[\w-]{6,20}$/.test(body.id) ? { id: body.id } : {}),
    ...(typeof body.publishAt === "string" ? { publishAt: body.publishAt.slice(0, 40) } : {}),
    ...(typeof body.error === "string" ? { error: body.error.slice(0, 300) } : {}),
  };
  try {
    await updatePost(id, (current) => ({ publish: { ...current.publish, youtube: { ...current.publish?.youtube, ...youtube, ...(youtube.error ? {} : { error: undefined }) } } }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Opslaan mislukt" }, { status: 404 });
  }
}
