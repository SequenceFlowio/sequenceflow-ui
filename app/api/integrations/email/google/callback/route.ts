import { completeGoogleSignIn, googleSendConfig } from "@/lib/email/google/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

/**
 * Google sends the user here in the window we opened. We finish the sign-in,
 * tell the Support One tab (same origin only) and close the window. There is
 * no session here: the one-time state decides which workspace this is for.
 */
function page(input: { ok: boolean; title: string; detail: string; origin: string }) {
  const payload = JSON.stringify({ type: "sf-google-connected", ok: input.ok });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Support One</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#f4f4f5;font:15px/1.5 system-ui,sans-serif}main{max-width:420px;padding:32px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#a1a1aa;margin:0}.ok{color:#c7f56f}</style></head>
<body><main><h1 class="${input.ok ? "ok" : ""}">${escapeHtml(input.title)}</h1><p>${escapeHtml(input.detail)}</p></main>
<script>try{if(window.opener){window.opener.postMessage(${payload},${JSON.stringify(input.origin)});setTimeout(function(){window.close()},${input.ok ? 1200 : 6000});}}catch(e){}</script></body></html>`;
  return new Response(html, {
    status: input.ok ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'",
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = new URL(googleSendConfig().redirectUri).origin;
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const googleError = url.searchParams.get("error");

  if (googleError || !state || !code) {
    return page({
      ok: false,
      origin,
      title: "Not connected / Niet gekoppeld",
      detail: googleError === "access_denied"
        ? "You cancelled the Google sign-in. Close this window and try again. / Je hebt het inloggen geannuleerd. Sluit dit venster en probeer opnieuw."
        : "Google did not finish the sign-in. Close this window and try again. / Google heeft het inloggen niet afgerond. Sluit dit venster en probeer opnieuw.",
    });
  }

  try {
    const result = await completeGoogleSignIn({ state, code });
    const detail = result.switchedFrom
      ? `Replies now go out from ${result.email} instead of ${result.switchedFrom}. / Antwoorden gaan nu vanaf ${result.email} in plaats van ${result.switchedFrom}.`
      : `Replies now go out from ${result.email}. You can close this window. / Antwoorden gaan nu vanaf ${result.email}. Je kunt dit venster sluiten.`;
    return page({ ok: true, origin, title: "Gmail connected / Gmail gekoppeld", detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in failed.";
    console.error("[google/callback]", message);
    return page({ ok: false, origin, title: "Not connected / Niet gekoppeld", detail: message });
  }
}
