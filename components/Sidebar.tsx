"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navItems = [
    { label: t.sidebar.inbox,     href: "/inbox"     },
    { label: t.sidebar.knowledge, href: "/knowledge" },
    { label: t.sidebar.settings,  href: "/settings"  },
  ];

  return (
    <aside
      className={[
        // Base
        "fixed inset-y-0 left-0 z-30 flex h-full w-52 flex-shrink-0 flex-col",
        "border-r border-[var(--border)] bg-[var(--bg)]",
        "transition-transform duration-300 ease-in-out",
        // Desktop: back in normal flow, always visible
        "lg:relative lg:z-auto lg:translate-x-0",
        // Mobile: slide in/out
        isOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-5">
        <span className="text-[13px] font-semibold tracking-wide text-[var(--text)]">
          SequenceFlow
        </span>
        <ThemeToggle />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 pt-3">
        {navItems.map(({ label, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={[
                "rounded-lg px-3 py-2 text-[13px] transition-all duration-150",
                isActive
                  ? "border border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text)]"
                  : "font-normal text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}

        {/* Analytics — disabled */}
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px]"
          style={{ cursor: "not-allowed", opacity: 0.4 }}
        >
          <span className="text-[var(--muted)]">{t.sidebar.analytics}</span>
          <span style={{
            fontSize: "10px", fontWeight: 600,
            background: "var(--border)", color: "var(--muted)",
            borderRadius: "4px", padding: "1px 5px", letterSpacing: "0.04em",
          }}>
            SOON
          </span>
        </div>
      </nav>
    </aside>
  );
}
