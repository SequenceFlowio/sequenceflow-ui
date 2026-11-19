import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { insertPosts, listPosts, updatePost } from "@/lib/contentCalendar/db";
import { localeOf } from "@/lib/contentCalendar/locale";
import { englishPost, translatable, translateToEnglish } from "@/lib/contentCalendar/translate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_PER_REQUEST = 8;

/**
 * Vertaalt Nederlandse carrousels naar Engelse posts (zelfde datum en tijd, New Yorkse tijd).
 * Body: { ids } voor losse posts, of { from, to } (yyyy-MM-dd) voor een periode.
 * Per aanvraag hooguit 8; de app roept opnieuw aan zolang er "remaining" is.
 */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const posts = await listPosts();
  const existing = new Set(posts.filter((p) => localeOf(p) === "en").map((p) => p.sourceId ?? p.id));
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = date(body.from);
  const to = date(body.to);
  const ids = Array.isArray(body.ids) ? new Set(body.ids.map(String)) : null;
  if (!ids && !from) return NextResponse.json({ error: "Kies posts of een periode" }, { status: 400 });

  const candidates = posts.filter((p) =>
    translatable(p)
    && p.status !== "rejected"
    && !existing.has(p.id)
    && !(p.englishSkip && !ids) // overgeslagen posts alleen opnieuw als je ze los kiest
    && (ids ? ids.has(p.id) : p.date >= from! && (!to || p.date <= to)));
  const batch = candidates.slice(0, MAX_PER_REQUEST);
  const results: Array<{ id: string; ok: boolean; headline?: string; skipped?: string; error?: string }> = [];
  const created = [];
  for (const post of batch) {
    try {
      const t = await translateToEnglish(post);
      if (t.skip) {
        await updatePost(post.id, { englishSkip: t.skip });
        results.push({ id: post.id, ok: true, skipped: t.skip });
        continue;
      }
      const en = englishPost(post, t);
      created.push(en);
      results.push({ id: en.id, ok: true, headline: en.headline });
    } catch (error) {
      results.push({ id: post.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (created.length) await insertPosts(created);
  return NextResponse.json({ results, created: created.length, remaining: Math.max(0, candidates.length - batch.length), ids: created.map((p) => p.id) });
}
