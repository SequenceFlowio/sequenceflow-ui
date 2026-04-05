"use client";

import { useEffect, useState } from "react";
import { useUpgradeModal } from "@/lib/upgradeModal";

const PLANS = [
  {
    id:      "starter" as const,
    name:    "Starter",
    price:   "€39",
    period:  "/maand",
    desc:    "Voor kleine teams",
    features: [
      "250 emails / maand",
      "1 Gmail inbox",
      "2 teamleden",
      "25 kennisdocumenten",
      "AI-concepten ter goedkeuring",
    ],
    recommended: false,
  },
  {
    id:      "pro" as const,
    name:    "Pro",
    price:   "€99",
    period:  "/maand",
    desc:    "Voor groeiende teams",
    features: [
      "750 emails / maand",
      "3 Gmail inboxes",
      "5 teamleden",
      "100 kennisdocumenten",
      "Auto-send — inbox runt zichzelf",
      "Volledige analytics",
    ],
    recommended: true,
  },
  {
    id:      "agency" as const,
    name:    "Agency",
    price:   "€299",
    period:  "/maand",
    desc:    "Voor grote teams & bureaus",
    features: [
      "2.000 emails / maand",
      "10 Gmail inboxes",
      "Onbeperkte teamleden",
      "Onbeperkte documenten",
      "Auto-send + prioriteitsondersteuning",
      "Geavanceerde policies",
    ],
    recommended: false,
  },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export function UpgradeModal() {
  const { state, close } = useUpgradeModal();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !state.forced) close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [state.isOpen, state.forced, close]);

  if (!state.isOpen) return null;

  async function handleUpgrade(planId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const topPlans = PLANS.filter(p => p.id !== "agency");
  const agencyPlan = PLANS.find(p => p.id === "agency")!;

  return (
    <div
      className="sf-modal-overlay"
      style={{ zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget && !state.forced) close(); }}
    >
      <div className="sf-modal sf-pricing-modal" style={{ animation: "um-slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <style>{`@keyframes um-slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>

        {/* Header */}
        <div className="sf-pricing-header">
          <div>
            <h2>Kies je plan</h2>
            <p>Start direct. Geen creditcard nodig voor de proefperiode.</p>
          </div>
          {!state.forced && (
            <button className="sf-modal__close" onClick={close} aria-label="Sluiten">
              <CloseIcon />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="sf-pricing-body">

          {/* Top 2 plan cards */}
          <div className="sf-pricing-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {topPlans.map(plan => (
              <div key={plan.id} className={["sf-plan-card", plan.recommended ? "sf-plan-card--highlight" : ""].join(" ")}>
                {plan.recommended && <span className="sf-plan-badge">Aanbevolen</span>}
                <div className="sf-plan-card__header">
                  <p className="sf-plan-card__name">{plan.name}</p>
                  <div className="sf-plan-card__price">
                    <span className="sf-plan-card__price-amount">{plan.price}</span>
                    <span className="sf-plan-card__price-period">{plan.period}</span>
                  </div>
                  <p className="sf-plan-card__desc">{plan.desc}</p>
                </div>
                <ul className="sf-plan-card__features">
                  {plan.features.map(f => (
                    <li key={f}><CheckIcon />{f}</li>
                  ))}
                </ul>
                <button
                  className={["sf-btn sf-btn--full", plan.recommended ? "sf-btn-primary" : "sf-btn-dark"].join(" ")}
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading}
                >
                  {loading ? "Laden…" : `Kies ${plan.name}`}
                </button>
              </div>
            ))}
          </div>

          {/* Agency — horizontal */}
          <div className="sf-plan-card sf-plan-card--agency">
            <div className="sf-plan-card__header">
              <p className="sf-plan-card__name">{agencyPlan.name}</p>
              <div className="sf-plan-card__price">
                <span className="sf-plan-card__price-amount">{agencyPlan.price}</span>
                <span className="sf-plan-card__price-period">{agencyPlan.period}</span>
              </div>
              <p className="sf-plan-card__desc">{agencyPlan.desc}</p>
            </div>
            <ul className="sf-plan-card__features" style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 24 }}>
              {agencyPlan.features.map(f => (
                <li key={f} style={{ width: "calc(50% - 12px)" }}><CheckIcon />{f}</li>
              ))}
            </ul>
            <div style={{ flexShrink: 0 }}>
              <button
                className="sf-btn sf-btn-dark"
                onClick={() => handleUpgrade(agencyPlan.id)}
                disabled={loading}
                style={{ whiteSpace: "nowrap" }}
              >
                {loading ? "Laden…" : "Kies Agency"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
