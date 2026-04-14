"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { UpgradeModal } from "./UpgradeModal";
import { TrialNudgeModal } from "./TrialNudgeModal";
import { UpgradeModalProvider } from "@/lib/upgradeModal";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

function LangToggle() {
  const { language, setLanguage } = useTranslation();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "2px",
      background: "var(--sf-surface)", border: "1px solid var(--sf-border)",
      borderRadius: "8px", padding: "3px",
    }}>
      {(["nl", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          style={{
            padding: "3px 9px", borderRadius: "6px", border: "none",
            background: language === lang ? "var(--sf-text)" : "transparent",
            color: language === lang ? "var(--sf-bg)" : "var(--sf-text-muted)",
            fontSize: "11px", fontWeight: 700, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.04em",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UpgradeModalProvider>
      <UpgradeModal />
      <TrialNudgeModal />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="sf-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="sf-main">
          {/* Top bar — hamburger (mobile) + lang toggle (always top-right) */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 24px", borderBottom: "1px solid var(--sf-border)",
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--sf-text-muted)", padding: 4 }}
              aria-label="Open navigation"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div style={{ marginLeft: "auto" }}>
              <LangToggle />
            </div>
          </div>

          {children}
        </main>
      </div>
    </UpgradeModalProvider>
  );
}
