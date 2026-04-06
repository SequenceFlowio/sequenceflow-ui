"use client";

import { useEffect, useState } from "react";
import { useUpgradeModal } from "@/lib/upgradeModal";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type Props = {
  plan:     string;
  daysLeft: number | null;
};

export function TrialBanner({ plan, daysLeft }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { open } = useUpgradeModal();
  const { t } = useTranslation();
  const ts = t.settings;

  // Hard paywall: auto-open forced modal on mount for expired plans
  useEffect(() => {
    if (plan === "expired") {
      open({ forced: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  if (dismissed) return null;

  if (plan === "expired") {
    // Modal is auto-opened — no banner needed (modal covers everything)
    return null;
  }

  if (plan === "trial" && daysLeft !== null && daysLeft <= 7) {
    const message = daysLeft === 1
      ? ts.trialBannerDay
      : ts.trialBannerDays.replace("{n}", String(daysLeft));

    return (
      <div style={{
        width: "100%", padding: "10px 20px",
        background: "rgba(251,191,36,0.10)", borderBottom: "1px solid rgba(251,191,36,0.35)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        fontSize: "13px", fontWeight: 500, color: "#fbbf24",
        flexWrap: "wrap",
      }}>
        <span>⚡ {message}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <button
            onClick={() => open()}
            style={{ background: "none", border: "none", color: "#fbbf24", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontSize: "13px", padding: 0, whiteSpace: "nowrap" }}
          >
            {ts.trialBannerCta}
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
