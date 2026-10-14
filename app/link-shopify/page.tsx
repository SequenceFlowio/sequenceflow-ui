"use client";

import { useEffect, useState } from "react";

/**
 * Opened by the Shopify app ("I already have an account"). The visitor is
 * signed in here (the proxy sends them to /login first), so this page creates
 * a one-time link code for their workspace, tagged with the Shopify app's
 * intent. The Shopify app picks it up by itself; nothing needs to be typed.
 */
type State =
  | { kind: "working" }
  | { kind: "done"; code: string }
  | { kind: "error"; message: string };

function useDutch() {
  const [dutch, setDutch] = useState(true);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem("sf_lang"); } catch { /* storage blocked */ }
    const value = stored === "en" || stored === "nl" ? stored === "nl" : navigator.language.toLowerCase().startsWith("nl");
    const timer = window.setTimeout(() => setDutch(value), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return dutch;
}

export default function LinkShopifyPage() {
  const dutch = useDutch();
  const t = (nl: string, en: string) => (dutch ? nl : en);
  const [state, setState] = useState<State>({ kind: "working" });

  useEffect(() => {
    const intent = new URLSearchParams(window.location.search).get("intent") ?? "";
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/shopify/link-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.code) throw new Error(data.error || "failed");
        if (cancelled) return;
        // If the Shopify app's window is still reachable, hand over directly;
        // otherwise it finds the code itself within a few seconds.
        try { window.opener?.postMessage({ type: "sf-shopify-link-code", code: data.code }, window.location.origin); } catch { /* opener gone */ }
        setState({ kind: "done", code: data.code });
      } catch (error) {
        if (!cancelled) setState({ kind: "error", message: error instanceof Error && error.message !== "failed" ? error.message : "" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const card: React.CSSProperties = { maxWidth: 520, margin: "12vh auto", padding: "32px 28px", borderRadius: 18, border: "1px solid var(--border, rgba(229,231,235,0.12))", background: "var(--surface, #111927)", color: "var(--text, #e5e7eb)", fontFamily: "inherit", display: "grid", gap: 14 };
  const muted: React.CSSProperties = { margin: 0, color: "var(--muted, #9ca3af)", lineHeight: 1.6 };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg, #0B1220)", padding: "0 16px" }}>
      <section style={card} aria-live="polite">
        <strong style={{ fontSize: 22 }}>{t("Shopify koppelen aan je account", "Link Shopify to your account")}</strong>
        {state.kind === "working" ? <p style={muted}>{t("Even geduld, we koppelen je winkel…", "One moment, linking your store…")}</p> : null}
        {state.kind === "done" ? (
          <>
            <p style={{ ...muted, color: "var(--tone-success, #B4F000)" }}>{t("Gelukt. Ga terug naar Shopify: je winkel wordt automatisch aan deze werkruimte gekoppeld.", "Done. Go back to Shopify: your store is linked to this workspace automatically.")}</p>
            <p style={muted}>{t("Je kunt dit tabblad sluiten.", "You can close this tab.")}</p>
            <p style={{ ...muted, fontSize: 13 }}>{t("Gebeurt er in Shopify na een halve minuut niets? Vul daar dan deze code in:", "Nothing happens in Shopify after half a minute? Enter this code there:")} <code style={{ fontWeight: 600, letterSpacing: ".08em" }}>{state.code}</code></p>
          </>
        ) : null}
        {state.kind === "error" ? (
          <>
            <p style={{ ...muted, color: "var(--tone-danger, #f08b82)" }}>{state.message || t("Koppelen is niet gelukt.", "Linking did not work.")}</p>
            <p style={muted}>{t("Alleen een beheerder van de werkruimte kan een Shopify-winkel koppelen. Ga terug naar Shopify en probeer het opnieuw.", "Only a workspace admin can link a Shopify store. Go back to Shopify and try again.")}</p>
          </>
        ) : null}
      </section>
    </main>
  );
}
