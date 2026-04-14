import { NextResponse } from "next/server";

// Gmail OAuth integration has been replaced by email forwarding.
// This endpoint is no longer active.

export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://emailreply.sequenceflow.io").replace(/\/$/, "");
  return NextResponse.redirect(`${base}/settings?tab=integrations`);
}
