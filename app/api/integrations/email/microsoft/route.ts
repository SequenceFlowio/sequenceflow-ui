import { NextResponse } from "next/server";

import { disconnectMicrosoft } from "@/lib/email/microsoft/connection";
import { requireMailboxAdmin } from "@/lib/email/google/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Disconnect Microsoft: stop reading and sending through Outlook. */
export async function DELETE(req: Request) {
  const context = await requireMailboxAdmin(req);
  if (context instanceof NextResponse) return context;
  try {
    await disconnectMicrosoft(context.tenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[microsoft/disconnect]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not disconnect Microsoft. Try again." }, { status: 500 });
  }
}
