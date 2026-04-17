"use client";

import { useEffect } from "react";

import { useStandaloneDictionary } from "@/lib/i18n/standalone";

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18.3a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useStandaloneDictionary();

  useEffect(() => {
    console.error("[root-error]", error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top, rgba(199,245,111,0.06), transparent 38%), var(--sf-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ width: "100%", maxWidth: 460, border: "1px solid var(--sf-border)", borderRadius: 22, background: "var(--sf-surface)", boxShadow: "0 28px 60px rgba(15,23,42,0.08)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--sf-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(251,191,36,0.12)", color: "#b45309", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <WarningIcon />
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "var(--sf-text-subtle)", textTransform: "uppercase", letterSpacing: "0.08em" }}>SequenceFlow</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--sf-text)" }}>{t.errorPage.title}</p>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.7, color: "var(--sf-text-muted)" }}>
            {t.errorPage.description}
          </p>
          {error.digest && (
            <div style={{ marginBottom: 18, padding: "10px 12px", borderRadius: 12, background: "var(--sf-surface-2)", border: "1px solid var(--sf-border)", fontSize: 12, color: "var(--sf-text-muted)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {t.errorPage.errorId}: {error.digest}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{ minWidth: 148, height: 48, borderRadius: 14, border: "none", background: "#C7F56F", color: "#0f1a00", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 10px 24px rgba(199,245,111,0.22)" }}
            >
              {t.errorPage.retry}
            </button>
            <a
              href="/inbox"
              style={{ minWidth: 148, height: 48, borderRadius: 14, border: "1px solid var(--sf-border)", background: "transparent", color: "var(--sf-text)", fontSize: 14, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 18px" }}
            >
              {t.common.backToInbox}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
