"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useUpgradeModal } from "@/lib/upgradeModal";
import { createClient } from "@/lib/supabaseClient";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

type PlanInfo = {
  plan: string;
  daysLeft: number | null;
  used: number;
  limit: number;
};

type UserInfo = {
  name: string;
  email: string;
  initials: string;
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
function IconAnalytics() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function IconKnowledge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  );
}
function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}
function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: "inbox",     href: "/inbox",     icon: <IconInbox /> },
  { key: "analytics", href: "/analytics", icon: <IconAnalytics /> },
  { key: "knowledge", href: "/knowledge", icon: <IconKnowledge /> },
  { key: "settings",  href: "/settings",  icon: <IconSettings /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { open: openUpgrade } = useUpgradeModal();
  const { mode, setMode } = useTheme();

  const [planInfo, setPlanInfo]   = useState<PlanInfo | null>(null);
  const [userInfo, setUserInfo]   = useState<UserInfo | null>(null);
  const [popoverOpen, setPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch plan info
  useEffect(() => {
    fetch("/api/billing/usage")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        let daysLeft: number | null = null;
        if (data.trialEndsAt) {
          const diff = new Date(data.trialEndsAt).getTime() - Date.now();
          daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }
        setPlanInfo({ plan: data.plan, daysLeft, used: data.used, limit: data.limit });
      })
      .catch(() => {});
  }, []);

  // Fetch user info
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const fullName =
        data.user.user_metadata?.full_name ??
        data.user.user_metadata?.name ??
        data.user.email?.split("@")[0] ??
        "User";
      const email = data.user.email ?? "";
      const parts = fullName.trim().split(" ");
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : fullName.slice(0, 2).toUpperCase();
      setUserInfo({ name: fullName, email, initials });
    });
  }, []);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popoverOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const showUpgradeCTA = planInfo && ["trial", "starter", "expired"].includes(planInfo.plan);
  const isExpired      = planInfo?.plan === "expired";
  const isTrial        = planInfo?.plan === "trial";

  const navLabels: Record<string, string> = {
    inbox:     t.sidebar.inbox,
    analytics: t.sidebar.analytics,
    knowledge: t.sidebar.knowledge,
    settings:  t.sidebar.settings,
  };

  return (
    <aside
      className={[
        "sf-sidebar",
        "transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      ].join(" ")}
    >
      {/* Logo */}
      <div className="sf-sidebar__logo">
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--sf-text)" }}>
          SequenceFlow
        </span>
      </div>

      {/* Nav */}
      <nav className="sf-sidebar__nav">
        {NAV_ITEMS.map(({ key, href, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={["sf-nav-item", isActive ? "sf-nav-item--active" : ""].join(" ")}
            >
              {icon}
              {navLabels[key] ?? key}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade / plan card */}
      {planInfo && showUpgradeCTA && (
        <div className="sf-sidebar__upgrade">
          <div className={isExpired ? "sf-trial-card sf-trial-card--danger" : "sf-upgrade-card"}>
            {isExpired ? (
              <>
                <div className="sf-trial-card__header">
                  <span className="sf-trial-card__label sf-trial-card__label--danger">Verlopen</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--sf-danger)", margin: "0 0 8px", lineHeight: 1.4 }}>
                  Geen emails meer verwerkt. Herstel je account.
                </p>
                <button
                  className="sf-upgrade-card__btn"
                  style={{ background: "#f87171", color: "#fff" }}
                  onClick={() => openUpgrade({ forced: true })}
                >
                  Account herstellen
                </button>
              </>
            ) : isTrial ? (
              <>
                <div className="sf-trial-card__header">
                  <span className={`sf-trial-card__label ${planInfo.daysLeft !== null && planInfo.daysLeft <= 3 ? "sf-trial-card__label--danger" : "sf-trial-card__label--warning"}`}>
                    Proefperiode
                  </span>
                  {planInfo.daysLeft !== null && (
                    <span className={`sf-trial-card__days ${planInfo.daysLeft <= 3 ? "sf-trial-card__days--danger" : "sf-trial-card__days--warning"}`}>
                      {planInfo.daysLeft}d
                    </span>
                  )}
                </div>
                {planInfo.limit > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--sf-text-subtle)", marginBottom: 4 }}>
                      <span>E-mails</span>
                      <span>{planInfo.used}/{planInfo.limit}</span>
                    </div>
                    <div className="sf-progress" style={{ height: 4 }}>
                      <div
                        className={`sf-progress__fill${Math.round((planInfo.used / planInfo.limit) * 100) >= 100 ? " sf-progress__fill--danger" : ""}`}
                        style={{ width: `${Math.min(100, Math.round((planInfo.used / planInfo.limit) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
                <button className="sf-upgrade-card__btn" onClick={() => openUpgrade()}>
                  Upgraden →
                </button>
              </>
            ) : (
              <>
                <p className="sf-upgrade-card__title">Upgraden naar Pro</p>
                <p className="sf-upgrade-card__desc">Meer emails, inboxes en teamleden.</p>
                <button className="sf-upgrade-card__btn" onClick={() => openUpgrade()}>
                  Bekijk plannen →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom: utility links + user row */}
      <div className="sf-sidebar__bottom" ref={popoverRef}>

        {/* User popover */}
        {popoverOpen && (
          <div className="sf-user-popover">
            <div className="sf-theme-toggle">
              <button
                className={["sf-theme-btn", mode === "light" ? "sf-theme-btn--active" : ""].join(" ")}
                onClick={() => setMode("light")}
              >
                <IconSun /> Licht
              </button>
              <button
                className={["sf-theme-btn", mode === "dark" ? "sf-theme-btn--active" : ""].join(" ")}
                onClick={() => setMode("dark")}
              >
                <IconMoon /> Donker
              </button>
            </div>
            <button className="sf-popover-item" onClick={() => { setPopover(false); router.push("/settings"); onClose(); }}>
              <IconSettings />
              Settings
            </button>
            <button className="sf-popover-item sf-popover-item--danger" onClick={handleLogout}>
              <IconLogout />
              Uitloggen
            </button>
          </div>
        )}

        <button className="sf-nav-item" onClick={onClose} style={{ cursor: "default", opacity: 0.6 }}>
          <IconVideo />
          Tutorial
        </button>
        <button className="sf-nav-item" onClick={onClose} style={{ cursor: "default", opacity: 0.6 }}>
          <IconMessage />
          Feedback
        </button>
        <button className="sf-nav-item" onClick={onClose} style={{ cursor: "default", opacity: 0.6 }}>
          <IconHelp />
          Support
        </button>

        {/* User row */}
        {userInfo && (
          <button className="sf-user-row" onClick={() => setPopover(v => !v)} style={{ marginTop: 4 }}>
            <div className="sf-user-avatar">{userInfo.initials}</div>
            <div className="sf-user-info">
              <p className="sf-user-name">{userInfo.name}</p>
              <p className="sf-user-email">{userInfo.email}</p>
            </div>
            <IconChevron />
          </button>
        )}
      </div>
    </aside>
  );
}
