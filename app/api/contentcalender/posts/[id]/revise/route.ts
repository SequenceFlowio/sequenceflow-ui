import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { getPost, updatePost } from "@/lib/contentCalendar/db";
import { reviseDraft, startImage } from "@/lib/contentCalendar/generator";
import { localeOf } from "@/lib/contentCalendar/locale";
import { translateToEnglish } from "@/lib/contentCalendar/translate";

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

  let draft: Awaited<ReturnType<typeof reviseDraft>> | Pick<typeof post, "headline" | "subline" | "slides" | "caption" | "hashtags"> | null = null;
  if (rewriteText && localeOf(post) === "en") {
    // Engels: opnieuw vertalen vanaf de Nederlandse bron, met de feedback erbij
    const source = post.sourceId ? await getPost(post.sourceId) : null;
    const t = await translateToEnglish(source ?? post, feedback, post);
    draft = t.skip ? null : { headline: t.headline, subline: t.subline, slides: t.slides, caption: t.caption, hashtags: t.hashtags };
  } else if (rewriteText) {
    draft = await reviseDraft(post, feedback);
  }
  let updated = await updatePost(id, { ...(draft ?? {}), feedback, status: "review" });
  if (newImage) updated = await startImage(updated, feedback);
  return NextResponse.json({ post: updated, textRevised: Boolean(draft) });
}
