import type { Metadata } from "next";
import { headers } from "next/headers";

import { DEFAULT_APP_ORIGIN, requestAppOrigin } from "@/lib/brand";
import { loadOAuthClient } from "@/lib/mcp/oauth";
import { OAUTH_PATHS, validateAuthorizationRequest } from "@/lib/mcp/oauthCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

/**
 * Consent page for MCP connectors (claude.ai, ChatGPT). The proxy sends
 * visitors who are not signed in to /login first and back here afterwards.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "App koppelen | SequenceFlow Support One", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const styles = `
.oauth-page{min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--text)}
.oauth-card{width:min(100%,440px);padding:28px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}
.oauth-card img{display:block;height:28px;width:auto;margin-bottom:22px}
.oauth-card h1{margin:0;font-size:21px;font-weight:600;letter-spacing:-.01em;line-height:1.35}
.oauth-card p{margin:10px 0 0;color:var(--muted);font-size:14px;line-height:1.6}
.oauth-card ul{margin:18px 0 0;padding:14px 16px 14px 34px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);font-size:13px;line-height:1.7}
.oauth-card .oauth-note{font-size:12px}
.oauth-actions{display:flex;gap:10px;margin-top:22px}
.oauth-actions button{flex:1;height:42px;border-radius:10px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.oauth-allow{border:0;background:var(--brand);color:#111}
.oauth-deny{border:1px solid var(--border);background:transparent;color:var(--text)}
`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="oauth-page">
      <style>{styles}</style>
      <div className="oauth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="SequenceFlow" />
        {children}
      </div>
    </main>
  );
}

export default async function OAuthAuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const headerList = await headers();
  const nl = !(headerList.get("accept-language") ?? "nl").toLowerCase().startsWith("en");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? new URL(DEFAULT_APP_ORIGIN).host;
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = requestAppOrigin(`${proto}://${host}/`);

  const client = await loadOAuthClient(params.client_id ?? "").catch(() => null);
  const request = validateAuthorizationRequest(params, client, origin);
  if ("error" in request && !request.redirectable) {
    return (
      <Shell>
        <h1>{nl ? "Deze koppeling werkt niet" : "This connection does not work"}</h1>
        <p>{nl ? "De app is onbekend of het terugstuuradres klopt niet. Verwijder de connector in Claude of ChatGPT en voeg hem opnieuw toe." : "The app is unknown or its return address does not match. Remove the connector in Claude or ChatGPT and add it again."}</p>
      </Shell>
    );
  }

  let context: Awaited<ReturnType<typeof getTenantId>> | null = null;
  try {
    context = await getTenantId(new Request(`${origin}${OAUTH_PATHS.authorize}`));
  } catch {
    context = null;
  }
  if (!context) {
    return (
      <Shell>
        <h1>{nl ? "Je bent niet ingelogd" : "You are not signed in"}</h1>
        <p>{nl ? "Log in op Support One en start het koppelen opnieuw vanuit Claude of ChatGPT." : "Sign in to Support One and start connecting again from Claude or ChatGPT."}</p>
      </Shell>
    );
  }
  if (context.role !== "admin") {
    return (
      <Shell>
        <h1>{nl ? "Alleen een beheerder kan apps koppelen" : "Only an admin can connect apps"}</h1>
        <p>{nl ? "Vraag de beheerder van je Support One-account om deze koppeling te maken." : "Ask the admin of your Support One account to make this connection."}</p>
      </Shell>
    );
  }

  const { data: tenant } = await getSupabaseAdmin().from("tenants").select("name").eq("id", context.tenantId).maybeSingle();
  const shopName = tenant?.name && !/^Tenant [0-9a-f]{8}$/.test(tenant.name) ? tenant.name : null;
  const appName = client!.client_name;

  return (
    <Shell>
      <h1>{nl ? `${appName} wil toegang tot Support One` : `${appName} wants access to Support One`}</h1>
      <p>
        {nl
          ? `Na goedkeuring kan ${appName} de supportgegevens${shopName ? ` van ${shopName}` : " van je winkel"} lezen:`
          : `Once approved, ${appName} can read the support data${shopName ? ` of ${shopName}` : " of your shop"}:`}
      </p>
      <ul>
        <li>{nl ? "Klantgesprekken en AI-concepten" : "Customer conversations and AI drafts"}</li>
        <li>{nl ? "Bestellingen, voorraad en retouren die Support One gebruikt" : "Orders, stock and returns Support One uses"}</li>
        <li>{nl ? "Je kennisbank en de cijfers van de afgelopen 30 dagen" : "Your knowledge base and the last 30 days of numbers"}</li>
      </ul>
      <p className="oauth-note">
        {nl
          ? "Alleen lezen: de app kan niets versturen, wijzigen of annuleren. Intrekken kan altijd onder Koppelingen."
          : "Read-only: the app cannot send, change or cancel anything. You can revoke access any time under Connections."}
      </p>
      <form method="post" action={OAUTH_PATHS.approve}>
        {Object.entries(params).map(([key, value]) => (
          ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "response_type", "resource", "scope"].includes(key) && value
            ? <input key={key} type="hidden" name={key} value={value} />
            : null
        ))}
        <div className="oauth-actions">
          <button type="submit" name="decision" value="deny" className="oauth-deny">{nl ? "Weigeren" : "Deny"}</button>
          <button type="submit" name="decision" value="allow" className="oauth-allow">{nl ? "Toestaan" : "Allow"}</button>
        </div>
      </form>
    </Shell>
  );
}
