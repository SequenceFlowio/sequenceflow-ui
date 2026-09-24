"use client";

import { useState } from "react";

import { PAID_PLAN_CATALOG, type PaidPlanId } from "@/lib/planCatalog";

// Dezelfde catalogus als het upgradevenster en de prijzenpagina. Deze pagina
// had een eigen lijst die daarvan afweek (documentlimieten, "inbox runt zichzelf").
const topPlans = PAID_PLAN_CATALOG.filter((plan) => plan.id !== "agency");
const agencyPlan = PAID_PLAN_CATALOG.find((plan) => plan.id === "agency")!;

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1, color: "var(--sf-green)" }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function UpgradePage() {
  const [loading, setLoading] = useState<PaidPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error("portal");
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
      if (!response.ok || !data.url) throw new Error("checkout");
      window.location.href = data.url;
    } catch {
      setError("Het betaalvenster kon niet worden geopend. Probeer het opnieuw.");
      setLoading(null);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--sf-bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
    }}>
      <style>{`
        @media (max-width: 640px) {
          .upgrade-grid { grid-template-columns: 1fr !important; }
          .upgrade-h1 { font-size: 24px !important; }
        }
      `}</style>
      <div style={{ marginBottom: 40 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="SequenceFlow" style={{ height: 40, width: "auto" }} />
      </div>

      <div style={{ textAlign: "center", marginBottom: 40, maxWidth: 520 }}>
        <h1 className="upgrade-h1" style={{ fontSize: 30, fontWeight: 500, color: "var(--sf-text)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Je proefperiode is verlopen
        </h1>
        <p style={{ fontSize: 15, color: "var(--sf-text-muted)", margin: 0, lineHeight: 1.6 }}>
          Kies een plan om verder te gaan met Support One.
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 800, display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? (
          <div role="alert" style={{ padding: "11px 13px", border: "1px solid rgba(248,113,113,.32)", borderRadius: 12, background: "rgba(248,113,113,.1)", color: "var(--tone-danger)", fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        <div className="upgrade-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {topPlans.map((plan) => (
            <div key={plan.id} className="sf-plan-card" style={plan.recommended ? { borderColor: "var(--sf-green)", background: "rgba(199,245,111,0.05)" } : {}}>
              {plan.recommended && <span className="sf-plan-badge">Aanbevolen</span>}
              <div className="sf-plan-card__header">
                <p className="sf-plan-card__name">{plan.name}</p>
                <div className="sf-plan-card__price">
                  <span className="sf-plan-card__price-amount">€{plan.price}</span>
                  <span className="sf-plan-card__price-period">/maand</span>
                </div>
                <p className="sf-plan-card__desc">{plan.description.nl}</p>
              </div>
              <ul className="sf-plan-card__features">
                {plan.features.nl.map((feature) => <li key={feature}><CheckIcon />{feature}</li>)}
              </ul>
              <button
                className={["sf-btn sf-btn--full", plan.recommended ? "sf-btn-primary" : "sf-btn-secondary"].join(" ")}
                onClick={() => void handleUpgrade(plan.id)}
                disabled={loading !== null}
              >
                {loading === plan.id ? "Laden…" : `Kies ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        <div className="sf-plan-card sf-plan-card--agency">
          <div className="sf-plan-card__header">
            <p className="sf-plan-card__name">{agencyPlan.name}</p>
            <div className="sf-plan-card__price">
              <span className="sf-plan-card__price-amount">€{agencyPlan.price}</span>
              <span className="sf-plan-card__price-period">/maand</span>
            </div>
            <p className="sf-plan-card__desc">{agencyPlan.description.nl}</p>
          </div>
          <ul className="sf-plan-card__features" style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 24, flex: 1, marginBottom: 0 }}>
            {agencyPlan.features.nl.map((feature) => (
              <li key={feature} style={{ width: "calc(50% - 12px)" }}><CheckIcon />{feature}</li>
            ))}
          </ul>
          <div style={{ flexShrink: 0 }}>
            <button
              className="sf-btn sf-btn-secondary"
              onClick={() => void handleUpgrade(agencyPlan.id)}
              disabled={loading !== null}
              style={{ whiteSpace: "nowrap" }}
            >
              {loading === agencyPlan.id ? "Laden…" : `Kies ${agencyPlan.name}`}
            </button>
          </div>
        </div>
      </div>

      <p style={{ marginTop: 32, fontSize: 13, color: "var(--sf-text-subtle)" }}>
        Verkeerd account?{" "}
        <a href="/api/auth/logout" style={{ color: "var(--sf-text-muted)", textDecoration: "underline", cursor: "pointer" }}
          onClick={async (e) => {
            e.preventDefault();
            const { createClient } = await import("@/lib/supabaseClient");
            await createClient().auth.signOut();
            window.location.href = "/login";
          }}
        >
          Uitloggen
        </a>
      </p>
    </div>
  );
}
