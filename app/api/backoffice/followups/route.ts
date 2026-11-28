import { NextResponse } from "next/server";

import { adminState, backofficeDemo } from "@/lib/backoffice/auth";
import { sendFollowup, skipFollowup } from "@/lib/sales/trials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const ID = /^[0-9a-f-]{36}$/i;

/**
 * Een beheerder verstuurt of slaat één opvolgmail van een proefaccount over.
 * Elke mail gaat pas weg na deze klik; er is geen automatische verzending.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 403, headers: HEADERS });
  const state = await adminState();
  if (state.state !== "ok") return NextResponse.json({ ok: false, error: "Log opnieuw in." }, { status: 401, headers: HEADERS });
  if (backofficeDemo()) return NextResponse.json({ ok: false, error: "Dit is de demo: er wordt niets verstuurd." }, { status: 400, headers: HEADERS });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400, headers: HEADERS });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!ID.test(id)) return NextResponse.json({ ok: false, error: "Onbekend concept." }, { status: 400, headers: HEADERS });
  const db = getSupabaseAdmin();
  try {
    if (body.action === "send") {
      await sendFollowup(db, id, {
        subject: typeof body.subject === "string" ? body.subject.slice(0, 200) : undefined,
        body: typeof body.body === "string" ? body.body.slice(0, 6000) : undefined,
      }, state.email);
      return NextResponse.json({ ok: true }, { headers: HEADERS });
    }
    if (body.action === "skip") {
      await skipFollowup(db, id, state.email);
      return NextResponse.json({ ok: true }, { headers: HEADERS });
    }
    return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400, headers: HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mislukt.";
    console.error("[backoffice/followups]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 409, headers: HEADERS });
  }
}
