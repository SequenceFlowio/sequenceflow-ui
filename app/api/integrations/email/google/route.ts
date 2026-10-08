import { NextResponse } from "next/server";

import { disconnectGoogle } from "@/lib/email/google/connection";
import { requireMailboxAdmin } from "@/lib/email/google/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Disconnect Google: revoke access at Google and send through SMTP again. */
export async function DELETE(req: Request) {
  const context = await requireMailboxAdmin(req);
  if (context instanceof NextResponse) return context;
  try {
    await disconnectGoogle(context.tenantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[google/disconnect]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not disconnect Google. Try again." }, { status: 500 });
  }
}
