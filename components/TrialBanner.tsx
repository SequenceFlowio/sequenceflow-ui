"use client";

import { useState } from "react";
import { useUpgradeModal } from "@/lib/upgradeModal";

type Props = {
  plan:     string;
  daysLeft: number | null;
};

const TRIAL_DAYS = 14;

export function TrialBanner({ plan, daysLeft }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { open: openUpgrade } = useUpgradeModal();

  if (dismissed) return null;
  if (plan === "expired") return null;
  if (plan !== "trial" || daysLeft === null || daysLeft > 7) return null;

  const used   = TRIAL_DAYS - daysLeft;
  const pct    = Math.min(100, Math.round((used / TRIAL_DAYS) * 100));
  const urgent = daysLeft <= 2;

  const barColor  = urgent ? "#f87171" : "#fb923c";
  const textColor = urgent ? "#7f1d1d" : "#78350f";
  const bgColor   = urgent ? "rgba(248,113,113,0.07)" : "rgba(251,146,60,0.07)";
  const borderColor = urgent ? "rgba(248,113,113,0.2)" : "rgba(251,146,60,0.2)";

  const label = daysLeft === 1
    ? "Nog 1 dag gratis"
    : `Nog ${daysLeft} dagen gratis`;

  return (
    <div style={{
      width: "100%",
      background: bgColor,
      borderBottom: `1px solid ${borderColor}`,
      padding: "7px 20px",
      display: "flex",
      alignItems: "center",
      gap: "14px",
      flexShrink: 0,
    }}>
      <span style={{ fontSize: "12px", color: textColor, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
        {label}
      </span>

      {/* Progress bar */}
      <div style={{
        flex: 1,
        maxWidth: 200,
        height: 5,
        background: urgent ? "rgba(248,113,113,0.2)" : "rgba(251,146,60,0.2)",
        borderRadius: 99,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: barColor,
          borderRadius: 99,
        }} />
      </div>

      <button
        onClick={() => openUpgrade()}
        style={{
          fontSize: "12px",
          color: textColor,
          fontWeight: 700,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          whiteSpace: "nowrap",
          textDecoration: "underline",
          marginLeft: "auto",
        }}
      >
        Kies een plan →
      </button>

      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: textColor,
          fontSize: "16px",
          lineHeight: 1,
          padding: 0,
          opacity: 0.5,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
