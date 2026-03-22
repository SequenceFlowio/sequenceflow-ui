"use client";

import { useEffect, useState } from "react";
import { useUpgradeModal } from "@/lib/upgradeModal";

const PLANS = [
  {
    id:      "starter" as const,
    name:    "Starter",
    price:   "€39",
    period:  "/maand",
    features: [
      "150 emails / maand",
      "1 Gmail inbox",
      "2 teamleden",
      "10 kennisdocumenten",
      "AI-antwoorden & concept inbox",
    ],
    recommended: false,
  },
  {
    id:      "growth" as const,
    name:    "Growth",
    price:   "€99",
    period:  "/maand",
    features: [
      "750 emails / maand",
      "3 Gmail inboxes",
      "5 teamleden",
      "50 kennisdocumenten",
      "Volledige analytics",
      "Antwoordtemplates",
    ],
    recommended: true,
  },
  {
    id:      "scale" as const,
    name:    "Scale",
    price:   "€249",
    period:  "/maand",
    features: [
      "3.000 emails / maand",
      "Onbeperkte inboxes",
      "Onbeperkte teamleden",
      "Onbeperkte documenten",
      "Volledige analytics",
      "Prioriteitsondersteuning",
    ],
    recommended: false,
  },
];

const FEATURE_ICONS = [
  { icon: "⚡", label: "AI-antwoorden in seconden" },
  { icon: "📊", label: "Volledige prestatie-inzichten" },
  { icon: "🔄", label: "Automatische Gmail-verwerking" },
  { icon: "📚", label: "Kennisbibliotheek" },
];

export function UpgradeModal() {
  const { state, close } = useUpgradeModal();
  const [selected, setSelected] = useState<"starter" | "growth" | "scale">("growth");
  const [loading,  setLoading]  = useState(false);

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

  async function handleCTA() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan: selected }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = PLANS.find(p => p.id === selected)!;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        animation: "um-fadeIn 0.18s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !state.forced) close(); }}
    >
      <style>{`
        @keyframes um-fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes um-slideUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .um-plan-radio:hover { border-color: rgba(180,240,0,0.5) !important; }

        .um-inner {
          display: flex;
          flex-direction: row;
          background: #0B1220;
          border-radius: 20px;
          width: 100%;
          max-width: 860px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6);
          animation: um-slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1);
          position: relative;
        }
        .um-left {
          flex: 1 1 54%;
          padding: 40px 36px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-width: 0;
        }
        .um-right {
          flex: 0 0 38%;
          background: linear-gradient(155deg, #B4F000 0%, #7ab800 60%, #0B1220 100%);
          border-radius: 0 20px 20px 0;
          padding: 40px 32px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          position: relative;
        }

        @media (max-width: 640px) {
          .um-inner {
            flex-direction: column;
            max-height: 95vh;
            border-radius: 16px;
          }
          .um-left {
            padding: 28px 20px;
            gap: 18px;
          }
          .um-right {
            display: none;
          }
        }
      `}</style>

      <div className="um-inner">

        {/* ── Left panel ── */}
        <div className="um-left">
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#B4F000", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>
              SupportFlow
            </p>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              Kies je plan
            </h2>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
              Start direct. Geen creditcard nodig voor de proefperiode.
            </p>
          </div>

          {/* Plan radio cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {PLANS.map(plan => {
              const isSelected = selected === plan.id;
              return (
                <button
                  key={plan.id}
                  className="um-plan-radio"
                  onClick={() => setSelected(plan.id)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "14px",
                    padding: "16px 18px", borderRadius: "12px",
                    border: `2px solid ${isSelected ? "#B4F000" : "rgba(255,255,255,0.10)"}`,
                    background: isSelected ? "rgba(180,240,0,0.07)" : "rgba(255,255,255,0.03)",
                    cursor: "pointer", textAlign: "left",
                    transition: "border-color 0.15s, background 0.15s",
                    position: "relative", width: "100%",
                  }}
                >
                  {/* Radio dot */}
                  <div style={{
                    width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                    border: `2px solid ${isSelected ? "#B4F000" : "rgba(255,255,255,0.25)"}`,
                    background: isSelected ? "#B4F000" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {isSelected && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0B1220" }} />}
                  </div>

                  {/* Plan info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{plan.name}</span>
                      {plan.recommended && (
                        <span style={{ fontSize: "10px", fontWeight: 700, background: "#B4F000", color: "#0B1220", borderRadius: "4px", padding: "1px 7px", letterSpacing: "0.04em" }}>
                          AANBEVOLEN
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: "0 0 6px", lineHeight: 1.4 }}>
                      {plan.features[0]} · {plan.features[1]}
                    </p>
                    {isSelected && (
                      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
                        {plan.features.map(f => (
                          <li key={f} style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: "5px" }}>
                            <span style={{ color: "#B4F000", fontSize: "10px" }}>✓</span>{f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Price */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ fontSize: "18px", fontWeight: 700, color: isSelected ? "#B4F000" : "#fff" }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{plan.period}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* CTA */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              onClick={handleCTA}
              disabled={loading}
              style={{
                width: "100%", padding: "14px 0", borderRadius: "10px", border: "none",
                background: loading ? "#86b800" : "#B4F000", color: "#0B1220",
                fontSize: "14px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#c8ff00"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#B4F000"; }}
            >
              {loading ? "Laden…" : `Kies ${selectedPlan.name} — ${selectedPlan.price}/mo`}
            </button>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", textAlign: "center", margin: 0 }}>
              Geen verborgen kosten. Op elk moment opzeggen.
            </p>
          </div>
        </div>

        {/* ── Right panel (hidden on mobile via CSS) ── */}
        <div className="um-right">
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "160px", height: "160px", borderRadius: "50%", background: "rgba(255,255,255,0.10)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "60px", left: "-30px", width: "100px", height: "100px", borderRadius: "50%", background: "rgba(11,18,32,0.2)", pointerEvents: "none" }} />

          <div>
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#0B1220", margin: "0 0 6px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              Automatiseer je klantenservice
            </p>
            <p style={{ fontSize: "13px", color: "rgba(11,18,32,0.65)", margin: "0 0 28px", lineHeight: 1.55 }}>
              AI beantwoordt emails — jij focust op wat echt telt.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {FEATURE_ICONS.map(({ icon, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(11,18,32,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                    {icon}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#0B1220", lineHeight: 1.3 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "rgba(11,18,32,0.15)", borderRadius: "12px", padding: "16px" }}>
            <p style={{ fontSize: "26px", fontWeight: 800, color: "#0B1220", margin: "0 0 2px", letterSpacing: "-0.02em" }}>72%</p>
            <p style={{ fontSize: "12px", color: "rgba(11,18,32,0.65)", margin: 0 }}>
              van emails automatisch opgelost — zonder menselijke tussenkomst
            </p>
          </div>
        </div>

        {/* X close */}
        {!state.forced && (
          <button
            onClick={close}
            style={{
              position: "absolute", top: "16px", right: "16px",
              width: "28px", height: "28px", borderRadius: "50%",
              border: "none", background: "rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.6)", fontSize: "16px", lineHeight: 1,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s, color 0.15s", zIndex: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            aria-label="Sluiten"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
