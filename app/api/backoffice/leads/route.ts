import { NextResponse } from "next/server";

import { adminState, backofficeDemo } from "@/lib/backoffice/auth";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/sales/leadsCore";
import { draftLead, importLead, leadEvents, updateLead, type LeadInput, type LeadPatch } from "@/lib/sales/store";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const MAX_IMPORT = 20;
const ID = /^[0-9a-f-]{36}$/i;

const str = (value: unknown, max = 4000) => (typeof value === "string" ? value.slice(0, max) : undefined);
const nullable = (value: unknown, max = 4000) => (value === null ? null : str(value, max));

/**
 * Leadmachine in de backoffice: leads importeren (verrijken + concept), status en
 * notities bijwerken, een nieuw concept vragen. Verstuurt nooit iets: LinkedIn
 * verstuurt Navaron zelf, mail pas vanaf het aparte domein.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 403, headers: HEADERS });
  const state = await adminState();
  if (state.state !== "ok") return NextResponse.json({ ok: false, error: "Log opnieuw in." }, { status: 401, headers: HEADERS });
  if (backofficeDemo()) return NextResponse.json({ ok: false, error: "Dit is de demo: er wordt niets vastgelegd." }, { status: 400, headers: HEADERS });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400, headers: HEADERS });
  }
  const db = getSupabaseAdmin();
  const actor = state.email;

  try {
    if (body.action === "import") {
      const raw = Array.isArray(body.items) ? body.items.slice(0, MAX_IMPORT) : [];
      const items: LeadInput[] = raw.map((item) => (typeof item === "string" ? { url: item } : item as Record<string, unknown>))
        .map((item) => ({ url: str((item as Record<string, unknown>).url, 300) ?? "", name: str((item as Record<string, unknown>).name, 120) ?? null, category: str((item as Record<string, unknown>).category, 80) ?? null, source: "backoffice" }))
        .filter((item) => item.url);
      const results = [];
      for (const item of items) results.push(await importLead(db, item, { actor }));
      return NextResponse.json({ ok: true, results }, { headers: HEADERS });
    }

    const id = str(body.id, 40) ?? "";
    if (!ID.test(id)) return NextResponse.json({ ok: false, error: "Onbekende lead." }, { status: 400, headers: HEADERS });

    if (body.action === "draft") {
      const result = await draftLead(db, id, actor);
      return result.ok ? NextResponse.json({ ok: true }, { headers: HEADERS }) : NextResponse.json({ ok: false, error: result.error }, { status: 409, headers: HEADERS });
    }

    if (body.action === "events") {
      return NextResponse.json({ ok: true, events: await leadEvents(db, id) }, { headers: HEADERS });
    }

    if (body.action === "update") {
      const p = (body.patch ?? {}) as Record<string, unknown>;
      const status = str(p.status, 20);
      const contacted = str(p.contacted, 20);
      const nextActionAt = nullable(p.nextActionAt, 40);
      const patch: LeadPatch = {
        status: status && (LEAD_STATUSES as readonly string[]).includes(status) ? status as LeadStatus : undefined,
        contacted: contacted === "linkedin" || contacted === "mail" || contacted === "telefoon" ? contacted : undefined,
        notes: nullable(p.notes),
        nextAction: nullable(p.nextAction, 200),
        nextActionAt: nextActionAt && Number.isNaN(Date.parse(nextActionAt)) ? undefined : nextActionAt,
        linkedinDraft: nullable(p.linkedinDraft, 600),
        emailSubject: nullable(p.emailSubject, 200),
        emailDraft: nullable(p.emailDraft),
      };
      await updateLead(db, id, patch, actor);
      return NextResponse.json({ ok: true }, { headers: HEADERS });
    }

    return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400, headers: HEADERS });
  } catch (error) {
    console.error("[backoffice/leads]", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Opslaan is mislukt." }, { status: 500, headers: HEADERS });
  }
}
