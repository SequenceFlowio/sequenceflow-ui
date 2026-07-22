"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { PAID_PLAN_CATALOG, type PaidPlanId } from "@/lib/planCatalog";
import { useUpgradeModal } from "@/lib/upgradeModal";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function UpgradeModal() {
  const { state, close } = useUpgradeModal();
  const { language } = useTranslation();
  const [loading, setLoading] = useState<PaidPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nl = language === "nl";

  useEffect(() => {
    if (!state.isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !state.forced) close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [state.isOpen, state.forced, close]);

  if (!state.isOpen) return null;

  async function openPortal() {
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error(data.error || "Portal unavailable");
    window.location.href = data.url;
  }

  async function handleUpgrade(planId: PaidPlanId) {
    setLoading(planId);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data.usePortal) return await openPortal();
      if (!response.ok || !data.url) throw new Error(data.error || "Checkout unavailable");
      window.location.href = data.url;
    } catch {
      setError(nl ? "Het betaalvenster kon niet worden geopend. Probeer het opnieuw." : "The payment window could not be opened. Please try again.");
      setLoading(null);
    }
  }

  const topPlans = PAID_PLAN_CATALOG.filter((plan) => plan.id !== "agency");
  const agencyPlan = PAID_PLAN_CATALOG.find((plan) => plan.id === "agency")!;

  return (
    <div className="sf-modal-overlay" style={{ zIndex: 9999 }} onClick={(event) => { if (event.target === event.currentTarget && !state.forced) close(); }}>
      <div className="sf-modal sf-pricing-modal" style={{ animation: "um-slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)" }} role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
        <style>{`@keyframes um-slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>

        <div className="sf-pricing-header">
          <div>
            <h2 id="upgrade-title">{nl ? "Kies je plan" : "Choose your plan"}</h2>
            <p>{nl ? "Kies de capaciteit die nu bij je team past." : "Choose the capacity that fits your team today."}</p>
          </div>
          {!state.forced ? <button type="button" className="sf-pricing-close" onClick={close} aria-label={nl ? "Sluit planselectie" : "Close plan selection"} title={nl ? "Sluiten" : "Close"}><X size={19} /></button> : null}
        </div>

        <div className="sf-pricing-body">
          {error ? <div role="alert" style={{ padding: "11px 13px", border: "1px solid #ffd2cc", borderRadius: 8, background: "#fff2f0", color: "#b42318", fontSize: 12 }}>{error}</div> : null}
          <div className="sf-pricing-grid">
            <div className="sf-plan-card" style={{ position: "relative" }}>
              <span className="sf-plan-badge" style={{ background: "#f3f4f6", color: "#6b7280" }}>{nl ? "7 dagen gratis" : "7 days free"}</span>
              <div className="sf-plan-card__header">
                <p className="sf-plan-card__name">{nl ? "Proefperiode" : "Trial"}</p>
                <div className="sf-plan-card__price"><span className="sf-plan-card__price-amount">€0</span><span className="sf-plan-card__price-period">/{nl ? "7 dagen" : "7 days"}</span></div>
                <p className="sf-plan-card__desc">{nl ? "Alles gratis uitproberen" : "Try everything for free"}</p>
              </div>
              <ul className="sf-plan-card__features">
                {[nl ? "150 e-mails" : "150 emails", "1 supportmailbox", nl ? "10 kennisdocumenten" : "10 knowledge documents", nl ? "AI-concepten ter goedkeuring" : "AI drafts for approval"].map((feature) => <li key={feature}><CheckIcon />{feature}</li>)}
              </ul>
              <button className="sf-btn sf-btn--full sf-btn-secondary" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>{nl ? "Proefperiode" : "Trial"}</button>
            </div>

            {topPlans.map((plan) => (
              <div key={plan.id} className={["sf-plan-card", plan.recommended ? "sf-plan-card--highlight" : ""].join(" ")}>
                {plan.recommended ? <span className="sf-plan-badge">{nl ? "Aanbevolen" : "Recommended"}</span> : null}
                <div className="sf-plan-card__header">
                  <p className="sf-plan-card__name">{plan.name}</p>
                  <div className="sf-plan-card__price"><span className="sf-plan-card__price-amount">€{plan.price}</span><span className="sf-plan-card__price-period">/{nl ? "maand" : "month"}</span></div>
                  <p className="sf-plan-card__desc">{plan.description[language]}</p>
                </div>
                <ul className="sf-plan-card__features">{plan.features[language].map((feature) => <li key={feature}><CheckIcon />{feature}</li>)}</ul>
                <button className={["sf-btn sf-btn--full", plan.recommended ? "sf-btn-primary" : "sf-btn-dark"].join(" ")} onClick={() => void handleUpgrade(plan.id)} disabled={loading !== null}>{loading === plan.id ? (nl ? "Laden…" : "Loading…") : `${nl ? "Kies" : "Choose"} ${plan.name}`}</button>
              </div>
            ))}
          </div>

          <div className="sf-plan-card sf-plan-card--agency">
            <div className="sf-plan-card__header">
              <p className="sf-plan-card__name">{agencyPlan.name}</p>
              <div className="sf-plan-card__price"><span className="sf-plan-card__price-amount">€{agencyPlan.price}</span><span className="sf-plan-card__price-period">/{nl ? "maand" : "month"}</span></div>
              <p className="sf-plan-card__desc">{agencyPlan.description[language]}</p>
            </div>
            <ul className="sf-plan-card__features" style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 24 }}>{agencyPlan.features[language].map((feature) => <li key={feature} style={{ width: "calc(50% - 12px)" }}><CheckIcon />{feature}</li>)}</ul>
            <div style={{ flexShrink: 0 }}><button className="sf-btn sf-btn-dark" onClick={() => void handleUpgrade(agencyPlan.id)} disabled={loading !== null} style={{ whiteSpace: "nowrap" }}>{loading === agencyPlan.id ? (nl ? "Laden…" : "Loading…") : `${nl ? "Kies" : "Choose"} Agency`}</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}
