"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { UpgradeModal } from "./UpgradeModal";
import { TrialNudgeModal } from "./TrialNudgeModal";
import { UpgradeModalProvider } from "@/lib/upgradeModal";
import { createClient } from "@/lib/supabaseClient";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const name =
        data.user.user_metadata?.full_name?.split(" ")[0] ??
        data.user.user_metadata?.name?.split(" ")[0] ??
        data.user.email?.split("@")[0] ??
        null;
      setDisplayName(name);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <UpgradeModalProvider>
    <UpgradeModal />
    <TrialNudgeModal />
    <div className="flex h-screen overflow-hidden transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Right column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex h-11 flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-4 transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">

          {/* Hamburger — mobile only */}
          <button
            className="mr-1 rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface)] lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <line x1="2" y1="4.5" x2="16" y2="4.5" />
              <line x1="2" y1="9"   x2="16" y2="9"   />
              <line x1="2" y1="13.5" x2="16" y2="13.5" />
            </svg>
          </button>

          {/* Right-side controls */}
          <div className="ml-auto flex items-center gap-4">

            {/* Welcome message */}
            {displayName && (
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                {t.sidebar.welcome}, <span style={{ fontWeight: 500, color: "var(--text)" }}>{displayName}</span>
              </span>
            )}

            <LanguageSwitcher />

            {/* Logout button */}
            <button
              onClick={handleLogout}
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--muted)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "3px 10px",
                cursor: "pointer",
                transition: "color 0.12s, border-color 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text)";
                e.currentTarget.style.borderColor = "var(--text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--muted)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              {t.sidebar.logout}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[var(--bg)] transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">
          {children}
        </main>
      </div>
    </div>
    </UpgradeModalProvider>
  );
}
