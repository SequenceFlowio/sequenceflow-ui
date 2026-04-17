"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { Sidebar } from "./Sidebar";
import { UpgradeModal } from "./UpgradeModal";
import { TrialNudgeModal } from "./TrialNudgeModal";
import { UpgradeModalProvider } from "@/lib/upgradeModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { language, setLanguage, t } = useTranslation();

  const topBarStyle: React.CSSProperties = {
    height: 48,
    borderBottom: "1px solid rgba(229,231,235,0.75)",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "0 20px",
    position: "sticky",
    top: 0,
    zIndex: 10,
    backdropFilter: "blur(10px)",
  };

  const segmentedWrapStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: 16,
    border: "1px solid var(--sf-border)",
    background: "rgba(255,255,255,0.66)",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  };

  const segmentButtonStyle = (active: boolean): React.CSSProperties => ({
    minWidth: 72,
    height: 32,
    borderRadius: 12,
    border: "none",
    background: active ? "var(--sf-surface)" : "transparent",
    boxShadow: active ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
    color: active ? "var(--sf-text)" : "var(--sf-text-muted)",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "all 120ms ease",
  });

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
          <div style={topBarStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--sf-text-muted)",
                  padding: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label={t.common.openNavigation}
                className="lg:hidden"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={segmentedWrapStyle} aria-label={t.common.language}>
              <button
                type="button"
                onClick={() => setLanguage("nl")}
                style={segmentButtonStyle(language === "nl")}
              >
                NL
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                style={segmentButtonStyle(language === "en")}
              >
                EN
              </button>
            </div>
          </div>

          {children}
        </main>
      </div>
    </UpgradeModalProvider>
  );
}
