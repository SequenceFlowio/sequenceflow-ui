"use client";

import { useState } from "react";
import Image from "next/image";

const PLANS = [
  {
    id:      "starter",
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
    id:      "pro",
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
    id:      "agency",
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1, color: "var(--sf-green)" }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(planId: string) {
    setLoading(planId);
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
      setLoading(null);
    }
  }

  const topPlans = PLANS.filter(p => p.id !== "agency");
  const agencyPlan = PLANS.find(p => p.id === "agency")!;

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
      {/* Logo */}
      <div style={{ marginBottom: 40 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-black.png" alt="SequenceFlow" style={{ height: 32, width: "auto" }} />
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40, maxWidth: 520 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--sf-text)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Je proefperiode is verlopen
        </h1>
        <p style={{ fontSize: 15, color: "var(--sf-text-muted)", margin: 0, lineHeight: 1.6 }}>
          Kies een plan om door te gaan met SequenceFlow. Je emails worden weer automatisch verwerkt zodra je plan actief is.
        </p>
      </div>

      {/* Plan cards */}
      <div style={{ width: "100%", maxWidth: 800, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Top 2 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {topPlans.map(plan => (
            <div key={plan.id} className="sf-plan-card" style={plan.recommended ? { borderColor: "var(--sf-green)", background: "rgba(199,245,111,0.05)" } : {}}>
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
                disabled={loading !== null}
              >
                {loading === plan.id ? "Laden…" : `Kies ${plan.name}`}
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
          <ul className="sf-plan-card__features" style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 24, flex: 1, marginBottom: 0 }}>
            {agencyPlan.features.map(f => (
              <li key={f} style={{ width: "calc(50% - 12px)" }}><CheckIcon />{f}</li>
            ))}
          </ul>
          <div style={{ flexShrink: 0 }}>
            <button
              className="sf-btn sf-btn-dark"
              onClick={() => handleUpgrade(agencyPlan.id)}
              disabled={loading !== null}
              style={{ whiteSpace: "nowrap" }}
            >
              {loading === agencyPlan.id ? "Laden…" : "Kies Agency"}
            </button>
          </div>
        </div>

      </div>

      {/* Logout link */}
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
