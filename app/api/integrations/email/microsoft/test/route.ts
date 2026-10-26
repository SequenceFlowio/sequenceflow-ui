import { NextResponse } from "next/server";

import { MicrosoftReconnectRequired } from "@/lib/email/microsoft/core";
import { loadMicrosoftConnection, sendViaMicrosoft } from "@/lib/email/microsoft/connection";
import { requireMailboxAdmin } from "@/lib/email/google/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends a test mail from the connected Outlook mailbox to itself. */
export async function POST(req: Request) {
  const context = await requireMailboxAdmin(req);
  if (context instanceof NextResponse) return context;
  const connection = await loadMicrosoftConnection(context.tenantId);
  if (!connection) return NextResponse.json({ error: "Sign in with Microsoft first." }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { language?: string };
  const english = body.language === "en";
  try {
    await sendViaMicrosoft({
      tenantId: context.tenantId,
      to: connection.email,
      subject: english ? "Support One test: sending works" : "Support One test: versturen werkt",
      text: english
        ? "This test was sent by Support One from your Outlook mailbox. It is in your inbox and in Sent Items."
        : "Deze test is door Support One verstuurd vanuit je Outlook-mailbox. Hij staat in je inbox en bij Verzonden items.",
    });
    return NextResponse.json({ ok: true, to: connection.email });
  } catch (error) {
    if (error instanceof MicrosoftReconnectRequired) {
      return NextResponse.json({ error: english ? "Microsoft access expired. Sign in with Microsoft again." : "De Microsoft-toegang is verlopen. Log opnieuw in met Microsoft.", reconnect: true }, { status: 409 });
    }
    console.error("[microsoft/test]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: english ? "The test mail could not be sent." : "De testmail kon niet worden verstuurd." }, { status: 502 });
  }
}
