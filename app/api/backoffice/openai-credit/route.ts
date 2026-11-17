import { NextResponse } from "next/server";

import { adminState, backofficeDemo } from "@/lib/backoffice/auth";
import { saveCredit } from "@/lib/backoffice/openaiCredit";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Een beheerder zet de stand van het OpenAI-tegoed zoals platform.openai.com die toont. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 403, headers: HEADERS });
  const state = await adminState();
  if (state.state !== "ok") return NextResponse.json({ ok: false, error: "Log opnieuw in." }, { status: 401, headers: HEADERS });
  if (backofficeDemo()) return NextResponse.json({ ok: false, error: "Dit is de demo: er wordt niets opgeslagen." }, { status: 400, headers: HEADERS });
  const body = await request.json().catch(() => ({})) as { balanceUsd?: unknown };
  const value = Number(String(body.balanceUsd ?? "").replace(/[$\s]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return NextResponse.json({ ok: false, error: "Vul een bedrag in dollars in, bijvoorbeeld 42,50." }, { status: 400, headers: HEADERS });
  try {
    await saveCredit(value, state.email);
    return NextResponse.json({ ok: true }, { headers: HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missing = /does not exist|schema cache/i.test(message);
    return NextResponse.json({ ok: false, error: missing ? "Voer eerst migratie 076 uit in Supabase." : "Opslaan lukte niet." }, { status: missing ? 409 : 500, headers: HEADERS });
  }
}
