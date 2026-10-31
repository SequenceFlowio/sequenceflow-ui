import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { getPost } from "@/lib/contentCalendar/db";
import { startImage } from "@/lib/contentCalendar/generator";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: "Post niet gevonden" }, { status: 404 });
  const { feedback } = await request.json().catch(() => ({}));
  return NextResponse.json({ post: await startImage(post, typeof feedback === "string" ? feedback : undefined) });
}
