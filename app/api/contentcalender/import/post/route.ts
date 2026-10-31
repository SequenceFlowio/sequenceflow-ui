import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { upsertPost } from "@/lib/contentCalendar/db";
import type { Post } from "@/lib/contentCalendar/types";

/** Eenmalig: lokaal gemaakte posts overzetten (upload eerst de foto's via import/media). */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const post = (await request.json()) as Post;
  if (!post?.id || !/^\d{4}-\d{2}-\d{2}$/.test(post.date ?? "") || !Array.isArray(post.slides)) {
    return NextResponse.json({ error: "Ongeldige post" }, { status: 400 });
  }
  await upsertPost(post);
  return NextResponse.json({ ok: true, id: post.id });
}
