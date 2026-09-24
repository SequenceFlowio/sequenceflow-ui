"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { Sidebar } from "./Sidebar";
import { SupportChatWidget } from "./SupportChatWidget";
import { UpgradeModal } from "./UpgradeModal";
import { UpgradeModalProvider } from "@/lib/upgradeModal";

export function AppShell({ children, isAdmin }: { children: React.ReactNode; isAdmin: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setShowMobileMenu(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <UpgradeModalProvider>
      <UpgradeModal />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="sf-mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="sf-shell">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin} />

        <main className="sf-main">
          {showMobileMenu ? (
            <div className="sf-appbar">
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
              <Link href="/dashboard" className="sf-appbar__brand" aria-label="Support One — overzicht">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sf-mark.png" alt="" width={32} height={32} />
                <strong>Support One</strong>
              </Link>
              <Link href="/inbox" className="sf-appbar__action">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
                {t.sidebar.inbox}
              </Link>
            </div>
          ) : null}

          {children}
        </main>
        <SupportChatWidget sidebarOpen={sidebarOpen} />
      </div>
    </UpgradeModalProvider>
  );
}
