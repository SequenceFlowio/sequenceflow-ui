import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { getPost, updatePost } from "@/lib/contentCalendar/db";
import { reviseDraft, startImage } from "@/lib/contentCalendar/generator";

export const maxDuration = 120;

/** Afgekeurd + feedback: tekst herschrijven en een nieuw beeld maken. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: "Post niet gevonden" }, { status: 404 });
  const { feedback, rewriteText = true, newImage = true } = await request.json();
  if (typeof feedback !== "string" || !feedback.trim()) return NextResponse.json({ error: "Feedback is verplicht" }, { status: 400 });

  const draft = rewriteText ? await reviseDraft(post, feedback) : null;
  let updated = await updatePost(id, { ...(draft ?? {}), feedback, status: "review" });
  if (newImage) updated = await startImage(updated, feedback);
  return NextResponse.json({ post: updated, textRevised: Boolean(draft) });
}
