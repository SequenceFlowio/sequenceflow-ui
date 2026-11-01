import { NextResponse } from "next/server";

import { REF_COOKIE } from "@/lib/referrals/program";
import { refCookieOptions, resolveRefCode } from "@/lib/referrals/server";

/**
 * Deelbare link: sequenceflow.io/r/<gebruikersnaam of k-code>. Onthoudt wie de bezoeker
 * stuurde (60 dagen, laatste klik telt) en gaat door naar de website of ?naar=/pad.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(request.url);
  const to = url.searchParams.get("naar");
  const destination = new URL(to && to.startsWith("/") && !to.startsWith("//") ? to : "/", url);
  const response = NextResponse.redirect(destination, 302);
  try {
    const ref = await resolveRefCode(code);
    if (ref) response.cookies.set(REF_COOKIE, code.toLowerCase(), refCookieOptions(request.headers.get("host")));
  } catch (error) {
    console.error("[r] code opzoeken mislukt", error);
  }
  return response;
}
