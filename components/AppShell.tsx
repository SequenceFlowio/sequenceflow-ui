"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { UpgradeModal } from "./UpgradeModal";
import { UpgradeModalProvider } from "@/lib/upgradeModal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UpgradeModalProvider>
      <UpgradeModal />

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
          {/* Mobile hamburger */}
          <div className="flex items-center px-4 py-3 lg:hidden border-b border-[var(--sf-border)]">
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--sf-text-muted)", padding: 4 }}
              aria-label="Open navigation"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>

          {children}
        </main>
      </div>
    </UpgradeModalProvider>
  );
}
