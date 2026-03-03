"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
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
        <header className="flex h-11 flex-shrink-0 items-center border-b border-[var(--border)] bg-[var(--bg)] px-4 transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">

          {/* Hamburger — mobile only */}
          <button
            className="mr-3 rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface)] lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <line x1="2" y1="4.5" x2="16" y2="4.5" />
              <line x1="2" y1="9"   x2="16" y2="9"   />
              <line x1="2" y1="13.5" x2="16" y2="13.5" />
            </svg>
          </button>

          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-[var(--bg)] transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">
          {children}
        </main>
      </div>
    </div>
  );
}
