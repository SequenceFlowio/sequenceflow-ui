import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { deletePost, updatePost } from "@/lib/contentCalendar/db";
import type { Post } from "@/lib/contentCalendar/types";

const EDITABLE = ["date", "time", "pillar", "format", "template", "headline", "subline", "slides", "caption", "hashtags", "scene", "status", "feedback"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json();
    const patch: Partial<Post> = {};
    for (const key of EDITABLE) if (key in body) (patch as Record<string, unknown>)[key] = body[key];
    const post = await updatePost(id, (current) => ({
      ...patch,
      ...(typeof body.selected === "number" ? { image: { ...current.image, selected: body.selected } } : {}),
    }));
    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Opslaan mislukt" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  await deletePost(id);
  return NextResponse.json({ ok: true });
}
