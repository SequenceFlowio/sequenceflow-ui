"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  limit: number | null;
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
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21a8 8 0 0 0-16 0"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function IconCreditCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
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
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
function IconExternalLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3"/>
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
function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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
  { key: "dashboard", href: "/dashboard", icon: <IconHome /> },
  { key: "inbox",     href: "/inbox",     icon: <IconInbox /> },
  { key: "analytics", href: "/analytics", icon: <IconAnalytics /> },
  { key: "knowledge", href: "/knowledge", icon: <IconKnowledge /> },
  { key: "settings",  href: "/settings",  icon: <IconSettings /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t, language, setLanguage } = useTranslation();
  const { open: openUpgrade } = useUpgradeModal();
  const { mode, setMode } = useTheme();

  const [planInfo, setPlanInfo]   = useState<PlanInfo | null>(null);
  const [userInfo, setUserInfo]   = useState<UserInfo | null>(null);
  const [popoverOpen, setPopover] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "invoice">("profile");
  const [portalLoading, setPortalLoading] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    if (!settingsOpen) return;
    const prev = document.body.style.overflow;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function openSettings(tab: "profile" | "invoice" = "profile") {
    setSettingsTab(tab);
    setPopover(false);
    setSettingsOpen(true);
  }

  async function handleBillingPortal() {
    try {
      setPortalLoading(true);
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(isNl
          ? "Geen Stripe-abonnement gevonden. Neem contact op via sequenceflownl@gmail.com."
          : "No Stripe subscription found. Contact us at sequenceflownl@gmail.com.");
      }
    } catch {
      alert(isNl ? "Er is iets misgegaan. Probeer het later opnieuw." : "Something went wrong. Please try again later.");
    } finally {
      setPortalLoading(false);
    }
  }

  const showUpgradeCTA = planInfo && ["trial", "starter", "expired"].includes(planInfo.plan);
  const isExpired      = planInfo?.plan === "expired";
  const isTrial        = planInfo?.plan === "trial";
  const isNl           = language === "nl";
  const settingsLabel  = isNl ? "Instellingen" : "Settings";
  const settingsSub    = isNl ? "Beheer je account en abonnement" : "Manage your account and subscription";
  const profileLabel   = isNl ? "Profiel" : "Profile";
  const signOutLabel   = isNl ? "Uitloggen" : "Sign out";
  const lightLabel     = isNl ? "Licht" : "Light";
  const darkLabel      = isNl ? "Donker" : "Dark";
  const mailsSentLabel = isNl ? "Mails verzonden deze maand" : "Mails sent this month";
  const currentPlanLabel = isNl ? "Je huidige plan" : "Your current plan";
  const upgradeLabel = isNl ? "Upgraden" : "Upgrade";
  const closeLabel = isNl ? "Sluiten" : "Close";
  const billingLabel = isNl ? "Abonnement" : "Billing";
  const profileManagedLabel = isNl ? "Profielinfo wordt beheerd via Google." : "Profile info is managed via Google.";
  const languageLabel = isNl ? "Taal" : "Language";
  const usageLimit = planInfo?.limit;
  const usageLimitDisplay = usageLimit == null ? "∞" : String(usageLimit);
  const usagePct =
    usageLimit && usageLimit > 0
      ? Math.min(100, Math.round(((planInfo?.used ?? 0) / usageLimit) * 100))
      : 0;
  const trialLimit = planInfo?.limit ?? 0;
  const planName = planInfo?.plan ? planInfo.plan.charAt(0).toUpperCase() + planInfo.plan.slice(1) : "—";
  const paidPlan = planInfo ? ["starter", "pro", "agency", "custom"].includes(planInfo.plan) : false;

  const navLabels: Record<string, string> = {
    dashboard: isNl ? "Home" : "Home",
    inbox:     t.sidebar.inbox,
    analytics: t.sidebar.analytics,
    knowledge: t.sidebar.knowledge,
    settings:  isNl ? "Instellingen" : "Settings",
  };

  return (
    <>
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mode === "dark" ? "/logo-white.png" : "/logo-black.png"}
          alt="SequenceFlow"
          style={{ height: 56, width: "auto", display: "block" }}
        />
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
                <p className="sf-upgrade-card__title">
                  {planInfo.daysLeft !== null
                    ? planInfo.daysLeft === 1
                      ? "Nog 1 dag gratis"
                      : `Nog ${planInfo.daysLeft} dagen gratis`
                    : "Proefperiode actief"}
                </p>
                <p className="sf-upgrade-card__desc">
                  Upgrade voor onbeperkte emails, auto-send en meer inboxes.
                </p>
                <button className="sf-upgrade-card__btn" onClick={() => openUpgrade()}>
                  Upgraden →
                </button>
              </>
            ) : (
              <>
                <p className="sf-upgrade-card__title">Upgraden naar Pro</p>
                <p className="sf-upgrade-card__desc">
                  Meer emails, 3 inboxes en auto-send — inbox runt zichzelf.
                </p>
                <button className="sf-upgrade-card__btn" onClick={() => openUpgrade()}>
                  Bekijk plannen →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom: utility links + user row */}
      <div className="sf-sidebar__bottom">

        <button className="sf-nav-item" onClick={() => { setTutorialOpen(true); onClose(); }}>
          <IconVideo />
          Tutorial
        </button>
        <button className="sf-nav-item" onClick={() => { setFeedbackOpen(true); onClose(); }}>
          <IconMessage />
          Feedback
        </button>
        <button className="sf-nav-item" onClick={() => { setSupportOpen(true); onClose(); }}>
          <IconHelp />
          Support
        </button>

        {/* User row — popover anchors to this wrapper */}
        {userInfo && (
          <div style={{ position: "relative", marginTop: 4 }} ref={popoverRef}>
            {popoverOpen && (
              <div className="sf-user-popover">
                <div className="sf-theme-toggle">
                  <button
                    className={["sf-theme-btn", mode === "light" ? "sf-theme-btn--active" : ""].join(" ")}
                    onClick={() => setMode("light")}
                  >
                    <IconSun /> {lightLabel}
                  </button>
                  <button
                    className={["sf-theme-btn", mode === "dark" ? "sf-theme-btn--active" : ""].join(" ")}
                    onClick={() => setMode("dark")}
                  >
                    <IconMoon /> {darkLabel}
                  </button>
                </div>
                <button className="sf-popover-item" onClick={() => openSettings("profile")}>
                  <IconSettings />
                  {settingsLabel}
                </button>
                <button className="sf-popover-item sf-popover-item--danger" onClick={handleLogout}>
                  <IconLogout />
                  {signOutLabel}
                </button>
              </div>
            )}
            <button className="sf-user-row" onClick={() => setPopover(v => !v)} style={{ width: "100%" }}>
              <div className="sf-user-avatar">{userInfo.initials}</div>
              <div className="sf-user-info">
                <p className="sf-user-name">{userInfo.name}</p>
                <p className="sf-user-email">{userInfo.email}</p>
              </div>
              <IconChevron />
            </button>
          </div>
        )}
      </div>
    </aside>
    {/* ── Support modal ─────────────────────────────────────── */}
    {supportOpen && (
      <div className="sf-modal-overlay" style={{ zIndex: 60 }} onClick={(e) => { if (e.target === e.currentTarget) setSupportOpen(false); }}>
        <div className="sf-modal" style={{ maxWidth: 420 }}>
          <div className="sf-modal__header">
            <div className="sf-modal__header-left">
              <div className="sf-modal__icon"><IconHelp /></div>
              <div>
                <p className="sf-modal__title">Contact opnemen</p>
                <p className="sf-modal__subtitle">Vragen of hulp nodig? Neem contact op met ons team.</p>
              </div>
            </div>
            <button className="sf-modal__close" onClick={() => setSupportOpen(false)}><IconX /></button>
          </div>

          <div style={{ padding: "0 24px 8px" }}>
            {/* Kennisbank row */}
            <a
              href="/docs"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--sf-border)", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--sf-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconBook />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--sf-text)" }}>Kennisbank</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--sf-text-muted)", marginTop: 2 }}>Bekijk handleidingen, tutorials en veelgestelde vragen</p>
              </div>
              <IconExternalLink />
            </a>

            {/* Email row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--sf-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconInbox />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--sf-text)", flex: 1 }}>hallo@sequenceflow.io</p>
              <button
                className="sf-btn sf-btn-secondary"
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => {
                  navigator.clipboard.writeText("hallo@sequenceflow.io");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Gekopieerd ✓" : "Kopiëren"}
              </button>
            </div>
          </div>

          <div className="sf-modal__footer">
            <a href="mailto:hallo@sequenceflow.io" className="sf-btn sf-btn-primary sf-btn--full" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", height: 44 }}>
              <IconSend />
              E-mail sturen
            </a>
          </div>
        </div>
      </div>
    )}

    {/* ── Tutorial modal ────────────────────────────────────── */}
    {tutorialOpen && (
      <div className="sf-modal-overlay" style={{ zIndex: 60 }} onClick={(e) => { if (e.target === e.currentTarget) setTutorialOpen(false); }}>
        <div className="sf-modal" style={{ maxWidth: 560 }}>
          <div className="sf-modal__header">
            <div className="sf-modal__header-left">
              <div className="sf-modal__icon"><IconVideo /></div>
              <div>
                <p className="sf-modal__title">Tutorial</p>
                <p className="sf-modal__subtitle">Leer hoe SequenceFlow werkt</p>
              </div>
            </div>
            <button className="sf-modal__close" onClick={() => setTutorialOpen(false)}><IconX /></button>
          </div>

          <div style={{ padding: "20px 24px 24px" }}>
            {/* Video placeholder */}
            <div style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "var(--sf-surface-2)",
              borderRadius: 12,
              border: "1px solid var(--sf-border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              color: "var(--sf-text-subtle)",
            }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--sf-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 24, height: 24, color: "var(--sf-text-muted)" }}><IconPlay /></div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--sf-text-muted)" }}>Video binnenkort beschikbaar</p>
            </div>
          </div>

          <div className="sf-modal__footer">
            <button className="sf-btn sf-btn-primary" onClick={() => setTutorialOpen(false)}>Sluiten</button>
          </div>
        </div>
      </div>
    )}

    {/* ── Feedback modal ────────────────────────────────────── */}
    {feedbackOpen && (
      <div className="sf-modal-overlay" style={{ zIndex: 60 }} onClick={(e) => { if (e.target === e.currentTarget) { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackText(""); } }}>
        <div className="sf-modal" style={{ maxWidth: 440 }}>
          <div className="sf-modal__header">
            <div className="sf-modal__header-left">
              <div className="sf-modal__icon"><IconMessage /></div>
              <div>
                <p className="sf-modal__title">Feedback of verzoek</p>
                <p className="sf-modal__subtitle">Deel je idee of meld een probleem. We lezen alles.</p>
              </div>
            </div>
            <button className="sf-modal__close" onClick={() => { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackText(""); }}><IconX /></button>
          </div>

          <div style={{ padding: "20px 24px 8px" }}>
            {feedbackSent ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ fontSize: 32, margin: "0 0 12px" }}>✓</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--sf-text)", margin: "0 0 6px" }}>Bedankt voor je feedback!</p>
                <p style={{ fontSize: 13, color: "var(--sf-text-muted)", margin: 0 }}>We nemen je bericht mee in de volgende update.</p>
              </div>
            ) : (
              <textarea
                className="sf-textarea"
                placeholder="Beschrijf je feedback of verzoek..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                style={{ width: "100%", minHeight: 120, resize: "vertical", boxSizing: "border-box" }}
              />
            )}
          </div>

          <div className="sf-modal__footer">
            {!feedbackSent ? (
              <button
                className="sf-btn sf-btn-primary"
                disabled={!feedbackText.trim()}
                onClick={async () => {
                  // TODO: wire up to backend or email
                  setFeedbackSent(true);
                  setFeedbackText("");
                }}
              >
                Versturen
              </button>
            ) : (
              <button className="sf-btn sf-btn-primary" onClick={() => { setFeedbackOpen(false); setFeedbackSent(false); }}>Sluiten</button>
            )}
          </div>
        </div>
      </div>
    )}

    {settingsOpen && (
      <div
        className="sf-modal-overlay"
        style={{ zIndex: 60 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSettingsOpen(false);
        }}
      >
        <div className="sf-modal sf-settings-modal">
          <div className="sf-modal__header">
            <div className="sf-modal__header-left">
              <div className="sf-modal__icon">
                <IconSettings />
              </div>
              <div>
                <p className="sf-modal__title">{settingsLabel}</p>
                <p className="sf-modal__subtitle">{settingsSub}</p>
              </div>
            </div>
            <button className="sf-modal__close" onClick={() => setSettingsOpen(false)}>
              <IconX />
            </button>
          </div>

          <div className="sf-settings-body">
            <nav className="sf-settings-tabs">
              <button
                className={["sf-settings-tab", settingsTab === "profile" ? "sf-settings-tab--active" : ""].join(" ")}
                onClick={() => setSettingsTab("profile")}
              >
                <IconUser />
                {profileLabel}
              </button>
              <button
                className={["sf-settings-tab", settingsTab === "invoice" ? "sf-settings-tab--active" : ""].join(" ")}
                onClick={() => setSettingsTab("invoice")}
              >
                <IconCreditCard />
                {billingLabel}
              </button>
            </nav>

            <div className="sf-settings-content">
              {settingsTab === "profile" ? (
                <>
                  <p className="sf-section-label">{profileLabel}</p>
                  <label className="sf-label">{isNl ? "Naam" : "Name"}</label>
                  <input className="sf-input sf-input-sm" value={userInfo?.name ?? ""} readOnly />

                  <div style={{ height: 14 }} />

                  <label className="sf-label">{isNl ? "E-mail" : "Email"}</label>
                  <input className="sf-input sf-input-sm" value={userInfo?.email ?? ""} readOnly />

                  <p style={{ fontSize: "12px", color: "var(--sf-text-subtle)", margin: "16px 0 0" }}>
                    {profileManagedLabel}
                  </p>

                  <div style={{ height: 1, background: "var(--sf-border)", margin: "16px 0" }} />

                  <label className="sf-label">{languageLabel}</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className={["sf-settings-tab", language === "nl" ? "sf-settings-tab--active" : ""].join(" ")}
                      style={{ width: "auto", padding: "8px 16px" }}
                      onClick={() => setLanguage("nl")}
                    >
                      Nederlands
                    </button>
                    <button
                      className={["sf-settings-tab", language === "en" ? "sf-settings-tab--active" : ""].join(" ")}
                      style={{ width: "auto", padding: "8px 16px" }}
                      onClick={() => setLanguage("en")}
                    >
                      English
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="sf-section-label">{billingLabel}</p>

                  <div className="sf-billing-card">
                    <div className="sf-billing-card__row">
                      <div>
                        <p className="sf-billing-card__plan-name">{planName}</p>
                        <p className="sf-billing-card__plan-status">{currentPlanLabel}</p>
                      </div>
                      <span className="sf-status-badge">{planName}</span>
                    </div>
                    <button
                      className="sf-btn sf-btn--full sf-btn-primary"
                      onClick={() => {
                        if (paidPlan) {
                          handleBillingPortal();
                        } else {
                          setSettingsOpen(false);
                          openUpgrade();
                        }
                      }}
                      disabled={portalLoading}
                    >
                      {portalLoading ? "…" : paidPlan ? t.settings.billingManage : upgradeLabel}
                    </button>
                  </div>

                  <div className="sf-credits-card">
                    <div className="sf-credits-card__row">
                      <p className="sf-credits-card__label">{mailsSentLabel}</p>
                      <span className="sf-credits-card__count">{planInfo?.used ?? 0} / {usageLimitDisplay}</span>
                    </div>
                    <div className="sf-progress">
                      <div className="sf-progress__fill" style={{ width: `${usagePct}%` }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="sf-modal__footer">
            <button className="sf-btn sf-btn-primary" onClick={() => setSettingsOpen(false)}>
              {closeLabel}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
