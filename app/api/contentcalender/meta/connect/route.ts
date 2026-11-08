import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { authorizeUrl, signState } from "@/lib/contentCalendar/meta";
import { API_PATH } from "@/lib/contentCalendar/paths";

const STATE_COOKIE = "sf_meta_state";

export const dynamic = "force-dynamic";


/** Start "Inloggen met Facebook" om Instagram en de Facebook-pagina te koppelen. */
export async function GET(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const nonce = randomBytes(16).toString("base64url");
  const redirectUri = `${new URL(request.url).origin}${API_PATH}/meta/callback`;
  try {
    const response = NextResponse.redirect(authorizeUrl(redirectUri, signState(nonce)));
    response.cookies.set(STATE_COOKIE, nonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: API_PATH });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Koppelen kan nu niet" }, { status: 503 });
  }
}
