"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useStandaloneDictionary } from "@/lib/i18n/standalone";
import { APP_ONLY_PATHS } from "@/lib/site";

/** Netwerkfouten: een pagina- of codeonderdeel kon niet worden opgehaald. */
export function isNetworkError(error: unknown) {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /ChunkLoadError|Loading chunk|Failed to fetch|Load failed|NetworkError|network error|fetch failed|ERR_INTERNET_DISCONNECTED/i.test(text);
}

function Icon({ offline }: { offline: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }} aria-hidden>
      {offline ? (
        <>
          <path d="M2 8.8a15 15 0 0 1 4.2-2.7" /><path d="M10.7 5.1A15 15 0 0 1 22 8.8" /><path d="M5 12.5a10 10 0 0 1 3.4-2" /><path d="M15.4 10.6A10 10 0 0 1 19 12.5" />
          <path d="M8.5 16.4a5 5 0 0 1 7 0" /><path d="M12 20h.01" /><path d="m2 2 20 20" />
        </>
      ) : (
        <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18.3a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>
      )}
    </svg>
  );
}

/**
 * Het ene foutscherm voor site en app. Zonder internet zegt het dat, en laadt het de
 * pagina vanzelf opnieuw zodra de verbinding terug is. Anders een algemene melding
 * met een weg terug die past bij waar je was: het overzicht in de app, de homepage op de site.
 */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useStandaloneDictionary();
  const pathname = usePathname();
  const inApp = APP_ONLY_PATHS.some((path) => pathname === path || pathname?.startsWith(`${path}/`));
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    console.error("[error]", error);
    const update = () => setOffline(!navigator.onLine || isNetworkError(error));
    update();
    // Terug online: de pagina opnieuw laden, zodat ook ontbrekende onderdelen opnieuw worden opgehaald.
    const online = () => window.location.reload();
    window.addEventListener("online", online);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", update);
    };
  }, [error]);

  const retry = () => (offline ? window.location.reload() : reset());

  return (
    <div style={{ minHeight: inApp ? "70vh" : "100vh", background: inApp ? "transparent" : "radial-gradient(circle at top, rgba(199,245,111,0.06), transparent 38%), var(--sf-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div role="alert" style={{ width: "100%", maxWidth: 460, border: "1px solid var(--sf-border)", borderRadius: 22, background: "var(--sf-surface)", boxShadow: "0 28px 60px rgba(15,23,42,0.08)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--sf-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: offline ? "rgba(148,163,184,0.14)" : "rgba(251,191,36,0.12)", color: offline ? "var(--sf-text-muted)" : "#b45309", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon offline={offline} />
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "var(--sf-text-subtle)", textTransform: "uppercase", letterSpacing: "0.08em" }}>SequenceFlow</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--sf-text)" }}>{offline ? t.errorPage.offlineTitle : t.errorPage.title}</p>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.7, color: "var(--sf-text-muted)" }}>
            {offline ? t.errorPage.offlineDescription : inApp ? t.errorPage.description : t.errorPage.siteDescription}
          </p>
          {error.digest && !offline ? (
            <div style={{ marginBottom: 18, padding: "10px 12px", borderRadius: 12, background: "var(--sf-surface-2)", border: "1px solid var(--sf-border)", fontSize: 12, color: "var(--sf-text-muted)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {t.errorPage.errorId}: {error.digest}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={retry} style={{ minWidth: 148, height: 48, borderRadius: 14, border: "none", background: "#C7F56F", color: "#0f1a00", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              {t.errorPage.retry}
            </button>
            {offline ? (
              <span style={{ fontSize: 13, color: "var(--sf-text-muted)" }}>{t.errorPage.offlineWaiting}</span>
            ) : (
              <Link href={inApp ? "/dashboard" : "/"} style={{ minWidth: 148, height: 48, borderRadius: 14, border: "1px solid var(--sf-border)", background: "transparent", color: "var(--sf-text)", fontSize: 14, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 18px" }}>
                {inApp ? t.errorPage.backToOverview : t.errorPage.backHome}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
