import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasContentAccess } from "@/lib/contentCalendar/access";
import { completeLogin, verifyState } from "@/lib/contentCalendar/meta";
import { API_PATH, APP_PATH } from "@/lib/contentCalendar/paths";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "sf_meta_state";

/** Terug van Facebook: code inwisselen, pagina's en Instagram-accounts opslaan. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (result: string) => {
    const response = NextResponse.redirect(new URL(`${APP_PATH}?meta=${encodeURIComponent(result)}`, url.origin));
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
    const result = await completeLogin(code, `${url.origin}${API_PATH}/meta/callback`);
    return back(result.selected ? "gekoppeld" : result.pages ? "kies-pagina" : "geen-pagina");
  } catch (error) {
    console.error("[meta] koppelen mislukt", error);
    return back("mislukt");
  }
}
