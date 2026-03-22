"use client";

import { useEffect, useState } from "react";
import { useUpgradeModal } from "@/lib/upgradeModal";

const SESSION_KEY = "sf_trial_nudge_shown";

type UsageInfo = {
  plan:     string;
  daysLeft: number | null;
  used:     number;
  limit:    number;
};

// ─── Three phases ─────────────────────────────────────────────────────────────
//  Phase 1: dag 8–14  → Discovery  (warm, curious)
//  Phase 2: dag 4–7   → Consideration (informative, calm)
//  Phase 3: dag 0–3   → Urgency (FOMO, now or never)
//  Expired            → Hard block

type Phase = "discovery" | "consideration" | "urgency" | "expired";

function getPhase(daysLeft: number | null, isExpired: boolean): Phase {
  if (isExpired)                             return "expired";
  if (daysLeft === null)                     return "discovery";
  if (daysLeft >= 8)                         return "discovery";
  if (daysLeft >= 4)                         return "consideration";
  return "urgency";
}

type PhaseContent = {
  icon:        string;
  accentColor: string;
  accentBg:    string;
  title:       (days: number | null) => string;
  subtitle:    (days: number | null) => string;
  featureLabel: string;
  featureBadge: string;
  featureBadgeBg: string;
  featureBadgeColor: string;
  ctaLabel:    string;
  ctaColor:    string;
  ctaTextColor: string;
  dismissLabel: string | null;
  canDismiss:  boolean;
};

const PHASE_CONTENT: Record<Phase, PhaseContent> = {
  discovery: {
    icon:             "🚀",
    accentColor:      "#B4F000",
    accentBg:         "rgba(180,240,0,0.12)",
    title:            (d) => "Je proefperiode is gestart!",
    subtitle:         (d) => `Je hebt ${d ?? 14} dagen lang volledige toegang tot SupportFlow. Ontdek hoe AI je klantenservice automatiseert — stel je kennisbibliotheek in en verwerk je eerste emails.`,
    featureLabel:     "Ontgrendeld tijdens proefperiode",
    featureBadge:     "PROBEER HET",
    featureBadgeBg:   "rgba(180,240,0,0.12)",
    featureBadgeColor:"#B4F000",
    ctaLabel:         "Bekijk de plannen",
    ctaColor:         "#B4F000",
    ctaTextColor:     "#0B1220",
    dismissLabel:     "Later bekijken",
    canDismiss:       true,
  },
  consideration: {
    icon:             "💡",
    accentColor:      "#60a5fa",
    accentBg:         "rgba(96,165,250,0.12)",
    title:            (d) => `Hoe bevalt SupportFlow tot nu toe?`,
    subtitle:         (d) => `Je proefperiode loopt over ${d} ${d === 1 ? "dag" : "dagen"} af. Vergelijk de plannen en kies wat bij je past — zo ga je zonder onderbreking door.`,
    featureLabel:     "Behoud toegang tot",
    featureBadge:     "ACTIEF",
    featureBadgeBg:   "rgba(96,165,250,0.12)",
    featureBadgeColor:"#60a5fa",
    ctaLabel:         "Bekijk de plannen →",
    ctaColor:         "#B4F000",
    ctaTextColor:     "#0B1220",
    dismissLabel:     "Misschien later",
    canDismiss:       true,
  },
  urgency: {
    icon:             "⏰",
    accentColor:      "#fbbf24",
    accentBg:         "rgba(251,191,36,0.12)",
    title:            (d) => d === 0
                        ? "Je proefperiode verloopt vandaag"
                        : `Nog ${d} ${d === 1 ? "dag" : "dagen"} — daarna stopt de AI`,
    subtitle:         (d) => `Na je proefperiode worden er geen emails meer automatisch verwerkt en verlies je toegang tot analytics. Upgrade nu en mis niets.`,
    featureLabel:     "Stopt na je proefperiode",
    featureBadge:     "VERLOOPT BINNENKORT",
    featureBadgeBg:   "rgba(251,191,36,0.12)",
    featureBadgeColor:"#fbbf24",
    ctaLabel:         "Upgrade nu — mis niets →",
    ctaColor:         "#fbbf24",
    ctaTextColor:     "#0B1220",
    dismissLabel:     "Ik begrijp het risico",
    canDismiss:       true,
  },
  expired: {
    icon:             "🔒",
    accentColor:      "#f87171",
    accentBg:         "rgba(239,68,68,0.12)",
    title:            () => "Je proefperiode is verlopen",
    subtitle:         () => "Er worden geen emails meer verwerkt en je analytics zijn geblokkeerd. Herstel je account om door te gaan.",
    featureLabel:     "Geblokkeerd",
    featureBadge:     "GEBLOKKEERD",
    featureBadgeBg:   "rgba(239,68,68,0.12)",
    featureBadgeColor:"#f87171",
    ctaLabel:         "Account herstellen →",
    ctaColor:         "#f87171",
    ctaTextColor:     "#fff",
    dismissLabel:     null,
    canDismiss:       false,
  },
};

const FEATURES = [
  { icon: "📬", label: "AI-antwoorden op emails" },
  { icon: "📊", label: "Analytics & prestatie-inzichten" },
  { icon: "📚", label: "Kennisbibliotheek & documenten" },
  { icon: "👥", label: "Teamleden & samenwerking" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function TrialNudgeModal() {
  const { open: openUpgrade } = useUpgradeModal();
  const [visible,   setVisible]   = useState(false);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;

    fetch("/api/billing/usage")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !["trial", "expired"].includes(data.plan)) return;

        let daysLeft: number | null = null;
        if (data.trialEndsAt) {
          const diff = new Date(data.trialEndsAt).getTime() - Date.now();
          daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }

        setUsageInfo({ plan: data.plan, daysLeft, used: data.used, limit: data.limit });
        setTimeout(() => setVisible(true), 800);
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  }

  function handleUpgrade() {
    dismiss();
    openUpgrade(usageInfo?.plan === "expired" ? { forced: true } : undefined);
  }

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  if (!visible || !usageInfo) return null;

  const isExpired = usageInfo.plan === "expired";
  const daysLeft  = usageInfo.daysLeft;
  const phase     = getPhase(daysLeft, isExpired);
  const c         = PHASE_CONTENT[phase];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "tn-fadeIn 0.2s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && c.canDismiss) dismiss(); }}
    >
      <style>{`
        @keyframes tn-fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tn-slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div style={{
        background:   "#0B1220",
        borderRadius: "20px",
        width:        "100%",
        maxWidth:     "460px",
        boxShadow:    "0 24px 80px rgba(0,0,0,0.6)",
        animation:    "tn-slideUp 0.24s cubic-bezier(0.34,1.56,0.64,1)",
        overflow:     "hidden",
        position:     "relative",
      }}>

        {/* Top accent bar */}
        <div style={{ height: "4px", background: c.accentColor }} />

        <div style={{ padding: "32px 32px 28px" }}>

          {/* Icon + heading */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "14px", flexShrink: 0,
              background: c.accentBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "24px",
            }}>
              {c.icon}
            </div>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.01em", lineHeight: 1.25 }}>
                {c.title(daysLeft)}
              </h2>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.55 }}>
                {c.subtitle(daysLeft)}
              </p>
            </div>
          </div>

          {/* Feature list */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px",
            padding: "6px 0",
            marginBottom: "24px",
          }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "10px 16px 8px" }}>
              {c.featureLabel}
            </p>
            {FEATURES.map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px" }}>
                <span style={{ fontSize: "15px", flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", flex: 1 }}>{label}</span>
                <span style={{
                  fontSize: "10px", fontWeight: 700,
                  color: c.featureBadgeColor,
                  background: c.featureBadgeBg,
                  borderRadius: "4px", padding: "2px 7px",
                  whiteSpace: "nowrap",
                }}>
                  {c.featureBadge}
                </span>
              </div>
            ))}
          </div>

          {/* Days indicator — phase 2 & 3 */}
          {(phase === "consideration" || phase === "urgency") && daysLeft !== null && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              marginBottom: "20px",
            }}>
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: "4px", borderRadius: "2px",
                  background: i < (14 - daysLeft)
                    ? c.accentColor
                    : "rgba(255,255,255,0.10)",
                  transition: "background 0.2s",
                }} />
              ))}
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", marginLeft: "4px" }}>
                {daysLeft}d over
              </span>
            </div>
          )}

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={handleUpgrade}
              style={{
                width: "100%", padding: "14px 0", borderRadius: "10px", border: "none",
                background: c.ctaColor, color: c.ctaTextColor,
                fontSize: "14px", fontWeight: 700,
                cursor: "pointer", transition: "opacity 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              {c.ctaLabel}
            </button>

            {c.dismissLabel && (
              <button
                onClick={dismiss}
                style={{
                  width: "100%", padding: "10px 0", borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent", color: "rgba(255,255,255,0.35)",
                  fontSize: "13px", fontWeight: 500, cursor: "pointer",
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                {c.dismissLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
