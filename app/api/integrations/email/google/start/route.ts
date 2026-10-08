import { NextResponse } from "next/server";

import { googleSendConfig, startGoogleSignIn } from "@/lib/email/google/connection";
import { requireMailboxAdmin } from "@/lib/email/google/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 1 of "Sign in with Google": returns the Google URL to open in a new window. */
export async function POST(req: Request) {
  const context = await requireMailboxAdmin(req);
  if (context instanceof NextResponse) return context;
  if (!googleSendConfig().enabled) return NextResponse.json({ error: "Sign in with Google is not available yet." }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({})) as { loginHint?: unknown };
    const loginHint = typeof body.loginHint === "string" && body.loginHint.includes("@") ? body.loginHint.trim().slice(0, 254) : null;
    const url = await startGoogleSignIn({
      tenantId: context.tenantId,
      userId: context.userId,
      returnTo: context.shopifyShop ? "shopify" : "app",
      loginHint,
    });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[google/start]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not start Google sign-in. Try again." }, { status: 500 });
  }
}
