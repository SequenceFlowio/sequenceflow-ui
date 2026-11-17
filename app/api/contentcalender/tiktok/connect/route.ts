import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { signState } from "@/lib/contentCalendar/metaCrypto";
import { API_PATH } from "@/lib/contentCalendar/paths";
import { tiktokAuthorizeUrl } from "@/lib/contentCalendar/tiktok";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "sf_tiktok_state";

/** Start "Inloggen met TikTok". */
export async function GET(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const nonce = randomBytes(16).toString("base64url");
  const redirectUri = `${new URL(request.url).origin}${API_PATH}/tiktok/callback`;
  try {
    const response = NextResponse.redirect(tiktokAuthorizeUrl(redirectUri, signState(nonce)));
    response.cookies.set(STATE_COOKIE, nonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: API_PATH });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Koppelen kan nu niet" }, { status: 503 });
  }
}
