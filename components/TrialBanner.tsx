"use client";

import { useState } from "react";
import { useUpgradeModal } from "@/lib/upgradeModal";

type Props = {
  plan:     string;
  daysLeft: number | null;
};

export function TrialBanner({ plan, daysLeft }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { open } = useUpgradeModal();

  if (dismissed) return null;

  if (plan === "expired") {
    return (
      <div style={{
        width: "100%", padding: "10px 20px",
        background: "rgba(239,68,68,0.12)", borderBottom: "1px solid rgba(239,68,68,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
        fontSize: "13px", fontWeight: 500, color: "#f87171",
        flexWrap: "wrap",
      }}>
        <span>🔒 Je proefperiode is verlopen — upgrade om emails te blijven verwerken</span>
        <button
          onClick={() => open({ forced: true })}
          style={{ background: "none", border: "none", color: "#f87171", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontSize: "13px", padding: 0, whiteSpace: "nowrap" }}
        >
          Kies een plan →
        </button>
      </div>
    );
  }

  if (plan === "trial" && daysLeft !== null && daysLeft <= 5) {
    return (
      <div style={{
        width: "100%", padding: "10px 20px",
        background: "rgba(251,191,36,0.10)", borderBottom: "1px solid rgba(251,191,36,0.35)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        fontSize: "13px", fontWeight: 500, color: "#fbbf24",
        flexWrap: "wrap",
      }}>
        <span>
          ⚡ Je 14-daagse proefperiode verloopt over {daysLeft} {daysLeft === 1 ? "dag" : "dagen"} — kies een plan om door te gaan
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <button
            onClick={() => open()}
            style={{ background: "none", border: "none", color: "#fbbf24", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontSize: "13px", padding: 0, whiteSpace: "nowrap" }}
          >
            Kies een plan →
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#fbbf24", fontSize: "16px", lineHeight: 1, padding: 0, opacity: 0.7 }}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return null;
}
