import { NextResponse } from "next/server";

import { GoogleReconnectRequired } from "@/lib/email/google/core";
import { loadGoogleConnection, sendViaGmail } from "@/lib/email/google/connection";
import { requireMailboxAdmin } from "@/lib/email/google/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends a test mail from the connected Gmail to itself. With forwarding on it
 * comes back into the Support One inbox, proving both directions at once.
 */
export async function POST(req: Request) {
  const context = await requireMailboxAdmin(req);
  if (context instanceof NextResponse) return context;
  const connection = await loadGoogleConnection(context.tenantId);
  if (!connection) return NextResponse.json({ error: "Sign in with Google first." }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { language?: string };
  const english = body.language === "en";
  try {
    await sendViaGmail({
      tenantId: context.tenantId,
      to: connection.googleEmail,
      subject: english ? "Support One test: sending works" : "Support One test: versturen werkt",
      text: english
        ? "This test was sent by Support One from your Gmail. If forwarding is on, it also appears in your Support One inbox within a minute."
        : "Deze test is door Support One verstuurd vanuit je Gmail. Staat doorsturen aan, dan verschijnt hij binnen een minuut ook in je Support One-inbox.",
    });
    return NextResponse.json({ ok: true, to: connection.googleEmail });
  } catch (error) {
    if (error instanceof GoogleReconnectRequired) {
      return NextResponse.json({ error: english ? "Google access expired. Sign in with Google again." : "De Google-toegang is verlopen. Log opnieuw in met Google.", reconnect: true }, { status: 409 });
    }
    console.error("[google/test]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: english ? "The test mail could not be sent." : "De testmail kon niet worden verstuurd." }, { status: 502 });
  }
}
