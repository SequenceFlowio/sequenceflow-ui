"use client";

import { useEffect, useState } from "react";
import { useUpgradeModal } from "@/lib/upgradeModal";

const SESSION_KEY = "sf_trial_nudge_shown";

type UsageInfo = {
  plan: string;
  daysLeft: number | null;
  used: number;
  limit: number;
};

export function TrialNudgeModal() {
  const { open: openUpgrade } = useUpgradeModal();
  const [visible,   setVisible]   = useState(false);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);

  useEffect(() => {
    // Only show once per browser session
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

        // Small delay so the page settles first
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
  const urgency   = isExpired || (daysLeft !== null && daysLeft <= 3);

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
      onClick={(e) => { if (e.target === e.currentTarget && !isExpired) dismiss(); }}
    >
      <style>{`
        @keyframes tn-fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tn-slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      <div style={{
        background:   "#0B1220",
        borderRadius: "20px",
        width:        "100%",
        maxWidth:     "480px",
        boxShadow:    "0 24px 80px rgba(0,0,0,0.6)",
        animation:    "tn-slideUp 0.24s cubic-bezier(0.34,1.56,0.64,1)",
        overflow:     "hidden",
        position:     "relative",
      }}>

        {/* Top accent bar */}
        <div style={{
          height:     "4px",
          background: urgency
            ? "linear-gradient(90deg, #f87171, #ef4444)"
            : "linear-gradient(90deg, #B4F000, #7ab800)",
        }} />

        <div style={{ padding: "32px 32px 28px" }}>

          {/* Icon + heading */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "14px", flexShrink: 0,
              background: urgency ? "rgba(239,68,68,0.12)" : "rgba(180,240,0,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "24px",
            }}>
              {isExpired ? "🔒" : urgency ? "⏰" : "⚡"}
            </div>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 5px", letterSpacing: "-0.01em" }}>
                {isExpired
                  ? "Je proefperiode is verlopen"
                  : daysLeft === 0
                    ? "Je proefperiode verloopt vandaag"
                    : daysLeft !== null && daysLeft <= 3
                      ? `Nog ${daysLeft} ${daysLeft === 1 ? "dag" : "dagen"} over`
                      : "Je proefperiode loopt bijna af"}
              </h2>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.5 }}>
                {isExpired
                  ? "Upgrade om emails te blijven verwerken en je inbox te bewaren."
                  : `Je hebt nog ${daysLeft !== null ? daysLeft : "?"} ${daysLeft === 1 ? "dag" : "dagen"} volledige toegang. Kies een plan om door te gaan zonder onderbreking.`}
              </p>
            </div>
          </div>

          {/* What they keep / lose */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
            display: "flex", flexDirection: "column", gap: "9px",
          }}>
            {[
              { icon: "📬", label: "AI-antwoorden op emails" },
              { icon: "📊", label: "Analytics & prestatie-inzichten" },
              { icon: "📚", label: "Kennisbibliotheek & documenten" },
              { icon: "👥", label: "Teamleden & samenwerking" },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "15px", flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)" }}>{label}</span>
                <span style={{
                  marginLeft: "auto", fontSize: "11px", fontWeight: 700,
                  color: isExpired ? "#f87171" : "#B4F000",
                  background: isExpired ? "rgba(239,68,68,0.12)" : "rgba(180,240,0,0.12)",
                  borderRadius: "4px", padding: "1px 7px",
                }}>
                  {isExpired ? "GEBLOKKEERD" : "ACTIEF"}
                </span>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={handleUpgrade}
              style={{
                width: "100%", padding: "14px 0", borderRadius: "10px", border: "none",
                background: urgency ? "#f87171" : "#B4F000",
                color: urgency ? "#fff" : "#0B1220",
                fontSize: "14px", fontWeight: 700,
                cursor: "pointer", transition: "opacity 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              {isExpired ? "Account herstellen →" : "Upgrade nu →"}
            </button>

            {!isExpired && (
              <button
                onClick={dismiss}
                style={{
                  width: "100%", padding: "10px 0", borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent", color: "rgba(255,255,255,0.4)",
                  fontSize: "13px", fontWeight: 500, cursor: "pointer",
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                Misschien later
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
