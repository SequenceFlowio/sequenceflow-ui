import { NextResponse } from "next/server";

import { adminState, backofficeDemo } from "@/lib/backoffice/auth";
import { recordAffiliatePayout } from "@/lib/referrals/payouts";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/**
 * Een beheerder legt vast dat een affiliate is uitbetaald (de overboeking zelf
 * doet hij bij de bank). Alleen met een sessie die met de authenticator is bevestigd.
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
  const affiliateId = typeof body.affiliateId === "string" ? body.affiliateId : "";
  if (!/^[0-9a-f-]{36}$/i.test(affiliateId)) return NextResponse.json({ ok: false, error: "Onbekende affiliate." }, { status: 400, headers: HEADERS });
  try {
    const result = await recordAffiliatePayout({ affiliateId, paidBy: state.email, reference: typeof body.reference === "string" ? body.reference : null });
    if ("error" in result) return NextResponse.json({ ok: false, error: result.error }, { status: 409, headers: HEADERS });
    return NextResponse.json({ ok: true, invoiceNumber: result.payout.invoiceNumber, totalCents: result.payout.totalCents }, { headers: HEADERS });
  } catch (error) {
    console.error("[backoffice/payouts]", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Vastleggen is mislukt. Er is niets gewijzigd." }, { status: 500, headers: HEADERS });
  }
}
