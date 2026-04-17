"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { Sidebar } from "./Sidebar";
import { UpgradeModal } from "./UpgradeModal";
import { TrialNudgeModal } from "./TrialNudgeModal";
import { UpgradeModalProvider } from "@/lib/upgradeModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { language, setLanguage, t } = useTranslation();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setShowMobileMenu(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

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
          className="sf-mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="sf-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="sf-main">
          <div className="sf-appbar">
            {showMobileMenu ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="sf-appbar__menu"
                aria-label={t.common.openNavigation}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            ) : null}

            <div className="sf-topbar-segmented" aria-label={t.common.language}>
              <button
                type="button"
                onClick={() => setLanguage("nl")}
                style={segmentButtonStyle(language === "nl")}
                data-active={language === "nl"}
              >
                NL
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                style={segmentButtonStyle(language === "en")}
                data-active={language === "en"}
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
