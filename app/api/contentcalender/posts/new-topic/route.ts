import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { listPosts, updatePost } from "@/lib/contentCalendar/db";
import { generateDrafts, planDrafts } from "@/lib/contentCalendar/generator";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_PER_REQUEST = 6;

/**
 * "Nieuw onderwerp": geeft posts die te veel op andere lijken een vers onderwerp.
 * Alleen de tekst verandert; de foto blijft, zodat er geen beeldcredits nodig zijn.
 */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { ids } = await request.json().catch(() => ({ ids: [] }));
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: "Geen posts opgegeven" }, { status: 400 });
  const posts = await listPosts();
  const results: Array<{ id: string; ok: boolean; headline?: string; error?: string }> = [];
  for (const id of ids.slice(0, MAX_PER_REQUEST).map(String)) {
    const post = posts.find((p) => p.id === id);
    if (!post || !["review", "rejected"].includes(post.status)) {
      results.push({ id, ok: false, error: "Alleen posts die nog beoordeeld moeten worden" });
      continue;
    }
    try {
      const others = posts.filter((p) => p.id !== id);
      let draft = null;
      for (let attempt = 0; attempt < 2 && !draft; attempt++) {
        [draft] = await generateDrafts(planDrafts([{ date: post.date }], others), others);
      }
      if (!draft) throw new Error("Geen onderwerp gevonden dat nog niet in de kalender staat");
      const updated = await updatePost(id, {
        pillar: draft.pillar, format: draft.format, factId: draft.factId, headline: draft.headline, subline: draft.subline,
        slides: draft.slides, caption: draft.caption, hashtags: draft.hashtags, status: "review",
      });
      Object.assign(post, updated); // volgende post in dezelfde aanvraag ziet dit onderwerp al
      results.push({ id, ok: true, headline: updated.headline });
    } catch (error) {
      results.push({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return NextResponse.json({ results });
}
