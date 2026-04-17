"use client";

import Link from "next/link";

import { useStandaloneDictionary } from "@/lib/i18n/standalone";

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="m16.5 7.5-3.4 9-2.9-5.1-5.2-2.8 11.5-1.1Z" />
    </svg>
  );
}

export default function NotFound() {
  const { t } = useStandaloneDictionary();

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top, rgba(199,245,111,0.06), transparent 38%), var(--sf-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ width: "100%", maxWidth: 460, border: "1px solid var(--sf-border)", borderRadius: 22, background: "var(--sf-surface)", boxShadow: "0 28px 60px rgba(15,23,42,0.08)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--sf-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(96,165,250,0.12)", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CompassIcon />
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "var(--sf-text-subtle)", textTransform: "uppercase", letterSpacing: "0.08em" }}>SequenceFlow</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--sf-text)" }}>{t.notFoundPage.title}</p>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.7, color: "var(--sf-text-muted)" }}>
            {t.notFoundPage.description}
          </p>
          <Link
            href="/inbox"
            style={{ minWidth: 160, height: 48, borderRadius: 14, border: "none", background: "#C7F56F", color: "#0f1a00", fontSize: 14, fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 18px", boxShadow: "0 10px 24px rgba(199,245,111,0.22)" }}
          >
            {t.common.backToInbox}
          </Link>
        </div>
      </div>
    </div>
  );
}
