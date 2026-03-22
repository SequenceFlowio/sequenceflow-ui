"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useUpgradeModal } from "@/lib/upgradeModal";

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

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { open: openUpgrade } = useUpgradeModal();
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);

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

  const navItems = [
    { label: t.sidebar.inbox,     href: "/inbox"     },
    { label: t.sidebar.analytics, href: "/analytics" },
    { label: t.sidebar.knowledge, href: "/knowledge" },
    { label: t.sidebar.settings,  href: "/settings"  },
  ];

  // Determine plan card state
  const showUpgradeCTA = planInfo && ["trial", "starter", "expired"].includes(planInfo.plan);
  const isExpired      = planInfo?.plan === "expired";
  const isTrial        = planInfo?.plan === "trial";

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-30 flex h-full w-52 flex-shrink-0 flex-col",
        "border-r border-[var(--border)] bg-[var(--bg)]",
        "transition-transform duration-300 ease-in-out",
        "lg:relative lg:z-auto lg:translate-x-0",
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
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Plan card */}
      {planInfo && (
        <div style={{ padding: "12px" }}>
          <div style={{
            borderRadius: "12px",
            border: `1px solid ${isExpired ? "rgba(239,68,68,0.35)" : showUpgradeCTA ? "rgba(180,240,0,0.25)" : "var(--border)"}`,
            background: isExpired ? "rgba(239,68,68,0.07)" : showUpgradeCTA ? "rgba(180,240,0,0.06)" : "var(--surface)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>

            {/* Plan name + badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", textTransform: "capitalize" }}>
                {planInfo.plan === "trial" ? "Proefperiode" : planInfo.plan.charAt(0).toUpperCase() + planInfo.plan.slice(1)}
              </span>
              {isTrial && planInfo.daysLeft !== null && (
                <span style={{
                  fontSize: "10px", fontWeight: 700,
                  background: planInfo.daysLeft <= 3 ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                  color: planInfo.daysLeft <= 3 ? "#f87171" : "#fbbf24",
                  borderRadius: "4px", padding: "1px 6px",
                }}>
                  {planInfo.daysLeft}d
                </span>
              )}
              {isExpired && (
                <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(239,68,68,0.15)", color: "#f87171", borderRadius: "4px", padding: "1px 6px" }}>
                  VERLOPEN
                </span>
              )}
              {!isTrial && !isExpired && (
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#B4F000", background: "rgba(180,240,0,0.12)", borderRadius: "4px", padding: "1px 6px" }}>
                  ACTIEF
                </span>
              )}
            </div>

            {/* Usage bar — show for trial/starter/growth */}
            {planInfo.limit > 0 && planInfo.limit !== Infinity && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>E-mails</span>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>{planInfo.used}/{planInfo.limit}</span>
                </div>
                <div style={{ height: "4px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                  {(() => {
                    const pct = Math.min(100, Math.round((planInfo.used / planInfo.limit) * 100));
                    const color = pct >= 100 ? "#f87171" : pct >= 80 ? "#fbbf24" : "#B4F000";
                    return <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px", transition: "width 0.4s ease" }} />;
                  })()}
                </div>
              </div>
            )}

            {/* Upgrade CTA */}
            {showUpgradeCTA && (
              <button
                onClick={() => openUpgrade(isExpired ? { forced: true } : undefined)}
                style={{
                  width: "100%", padding: "7px 0",
                  borderRadius: "7px", border: "none",
                  background: isExpired ? "#f87171" : "#B4F000",
                  color: isExpired ? "#fff" : "#0B1220",
                  fontSize: "12px", fontWeight: 700,
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                {isExpired ? "Account herstellen" : "Upgraden →"}
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
