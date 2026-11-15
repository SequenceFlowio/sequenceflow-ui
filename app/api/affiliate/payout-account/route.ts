import { NextResponse } from "next/server";

import { affiliateByToken, savePayoutAccount } from "@/lib/referrals/payouts";
import { allowRequest, clientIp } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

/** Een affiliate vult de rekening in waarop commissie wordt uitbetaald. De dashboardlink is de sleutel. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }
  if (!(await allowRequest("affiliate-payout-account", clientIp(req), { limit: 10, windowSeconds: 60 * 60 }))) {
    return NextResponse.json({ error: "Te veel pogingen. Probeer het over een uur opnieuw." }, { status: 429 });
  }
  const affiliate = await affiliateByToken(typeof body.token === "string" ? body.token : "");
  if (!affiliate || affiliate.status === "blocked") return NextResponse.json({ error: "Deze link werkt niet." }, { status: 401 });
  try {
    const result = await savePayoutAccount(affiliate.id, {
      accountHolder: typeof body.accountHolder === "string" ? body.accountHolder : "",
      iban: typeof body.iban === "string" ? body.iban : "",
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, account: result.account }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[affiliate/payout-account]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Opslaan lukte niet. Probeer het later opnieuw." }, { status: 500 });
  }
}
