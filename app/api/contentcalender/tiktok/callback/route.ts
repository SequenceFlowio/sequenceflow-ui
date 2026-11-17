import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasContentAccess } from "@/lib/contentCalendar/access";
import { verifyState } from "@/lib/contentCalendar/metaCrypto";
import { API_PATH, APP_PATH } from "@/lib/contentCalendar/paths";
import { completeTikTokLogin } from "@/lib/contentCalendar/tiktok";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "sf_tiktok_state";

/** Terug van TikTok: code inwisselen en de koppeling opslaan. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (result: string) => {
    const response = NextResponse.redirect(new URL(`${APP_PATH}?tiktok=${encodeURIComponent(result)}`, url.origin));
    response.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: API_PATH });
    return response;
  };
  if (!(await hasContentAccess())) return NextResponse.redirect(new URL(`${APP_PATH}/login`, url.origin));
  const store = await cookies();
  if (!verifyState(url.searchParams.get("state"), store.get(STATE_COOKIE)?.value)) return back("ongeldig");
  if (url.searchParams.get("error")) return back("geannuleerd");
  const code = url.searchParams.get("code");
  if (!code) return back("ongeldig");
  try {
    await completeTikTokLogin(code, `${url.origin}${API_PATH}/tiktok/callback`);
    return back("gekoppeld");
  } catch (error) {
    console.error("[tiktok] koppelen mislukt", error);
    return back("mislukt");
  }
}
