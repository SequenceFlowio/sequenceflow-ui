import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { getPost } from "@/lib/contentCalendar/db";
import { publishPost } from "@/lib/contentCalendar/publisher";

export const maxDuration = 300;

/** Handmatig "Nu posten" vanuit het detailpaneel. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: "Post niet gevonden" }, { status: 404 });
  try {
    return NextResponse.json({ post: await publishPost(post) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Posten mislukt" }, { status: 400 });
  }
}
