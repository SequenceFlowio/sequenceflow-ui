"use client";

import { useState } from "react";
import Link from "next/link";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function IconMessage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}
function IconPartner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
      <circle cx="12" cy="8" r="4"/>
      <path d="M20 21a8 8 0 0 0-16 0"/>
      <path d="M16 11l2 2 4-4"/>
    </svg>
  );
}
function IconExternalLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── Mock email card ───────────────────────────────────────────────────────────

function MockEmailCard({ from, subject, preview, status }: { from: string; subject: string; preview: string; status: "auto" | "review" | "waiting" }) {
  const statusStyle: Record<string, { label: string; color: string; bg: string }> = {
    auto:    { label: "Automatisch verzonden", color: "#3d6200", bg: "rgba(199,245,111,0.35)" },
    review:  { label: "Ter goedkeuring",       color: "#1e40af", bg: "rgba(59,130,246,0.12)"  },
    waiting: { label: "Wacht op antwoord",      color: "#6b7280", bg: "#f3f4f6"               },
  };
  const s = statusStyle[status];
  return (
    <div style={{
      background: "var(--sf-surface)",
      border: "1px solid var(--sf-border)",
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--sf-text)" }}>{from}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{s.label}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--sf-text-secondary)" }}>{subject}</p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--sf-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [supportOpen, setSupportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div style={{ minHeight: "100%", background: "var(--sf-bg)", overflowY: "auto" }}>

      {/* ── Hero ────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "64px 32px 48px",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(199,245,111,0.25)",
          border: "1px solid rgba(199,245,111,0.5)",
          borderRadius: 99,
          padding: "4px 14px",
          marginBottom: 24,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3d6200" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#3d6200" }}>AI-aangedreven e-mail</span>
        </div>

        <h1 style={{
          fontSize: 42,
          fontWeight: 800,
          color: "var(--sf-text)",
          margin: "0 0 16px",
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
        }}>
          Inbox op automatische piloot
        </h1>

        <p style={{
          fontSize: 17,
          color: "var(--sf-text-muted)",
          margin: "0 auto 32px",
          maxWidth: 520,
          lineHeight: 1.65,
        }}>
          SequenceFlow leest, begrijpt en beantwoordt je klantemails — razendsnel, persoonlijk en consistent met jouw stijl.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/inbox"
            className="sf-btn sf-btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "12px 24px", fontSize: 15, fontWeight: 700 }}
          >
            <IconInbox />
            Ga naar de inbox →
          </Link>
        </div>
      </div>

      {/* ── Mock inbox preview ──────────────────────────────── */}
      <div style={{ maxWidth: 680, margin: "0 auto 64px", padding: "0 32px" }}>
        <div style={{
          background: "var(--sf-surface)",
          border: "1px solid var(--sf-border)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>
          {/* Fake top bar */}
          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--sf-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80" }} />
            <span style={{ fontSize: 12, color: "var(--sf-text-subtle)", marginLeft: 8 }}>SequenceFlow Inbox</span>
          </div>
          {/* Email cards */}
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <MockEmailCard from="Thomas de Vries" subject="Vraag over mijn bestelling #4821" preview="Hallo, ik wilde even navragen wanneer mijn pakket arriveert. Het is nu al 5 dagen..." status="auto" />
            <MockEmailCard from="Lisa Bakker" subject="Retour aanvragen — kapot product" preview="Goedemiddag, ik heb afgelopen week een product ontvangen dat beschadigd was..." status="review" />
            <MockEmailCard from="Marc Janssen" subject="Samenwerking bespreken" preview="Dag team, ik ben geïnteresseerd in een partnership met jullie bedrijf en..." status="waiting" />
          </div>
        </div>
      </div>

      {/* ── Bottom cards ────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>

          {/* Request Feature */}
          <div style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--sf-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconMessage />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--sf-text)" }}>Functie aanvragen</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--sf-text-muted)", lineHeight: 1.5 }}>Heb je een idee om SequenceFlow te verbeteren? We horen het graag.</p>
            </div>
            <button
              className="sf-btn sf-btn-secondary"
              style={{ marginTop: "auto", fontSize: 13 }}
              onClick={() => setFeedbackOpen(true)}
            >
              Functie aanvragen
            </button>
          </div>

          {/* Support */}
          <div style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--sf-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconHelp />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--sf-text)" }}>Support</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--sf-text-muted)", lineHeight: 1.5 }}>Heb je een vraag of loop je ergens tegenaan? Ons team helpt je graag.</p>
            </div>
            <button
              className="sf-btn sf-btn-secondary"
              style={{ marginTop: "auto", fontSize: 13 }}
              onClick={() => setSupportOpen(true)}
            >
              Neem contact op
            </button>
          </div>

          {/* Partner worden */}
          <div style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 12, opacity: 0.7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--sf-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconPartner />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sf-text-subtle)", background: "var(--sf-surface-2)", borderRadius: 6, padding: "3px 8px" }}>Binnenkort</span>
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--sf-text)" }}>Partner worden</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--sf-text-muted)", lineHeight: 1.5 }}>Word affiliate partner en verdien commissie op elke doorverwijzing.</p>
            </div>
            <button className="sf-btn sf-btn-secondary" style={{ marginTop: "auto", fontSize: 13 }} disabled>
              Aanmelden als partner
            </button>
          </div>

        </div>
      </div>

      {/* ── Support modal ─────────────────────────────────────── */}
      {supportOpen && (
        <div className="sf-modal-overlay" style={{ zIndex: 60 }} onClick={(e) => { if (e.target === e.currentTarget) setSupportOpen(false); }}>
          <div className="sf-modal" style={{ maxWidth: 420 }}>
            <div className="sf-modal__header">
              <div className="sf-modal__header-left">
                <div className="sf-modal__icon"><IconHelp /></div>
                <div>
                  <p className="sf-modal__title">Contact opnemen</p>
                  <p className="sf-modal__subtitle">Vragen of hulp nodig? Neem contact op met ons team.</p>
                </div>
              </div>
              <button className="sf-modal__close" onClick={() => setSupportOpen(false)}><IconX /></button>
            </div>

            <div style={{ padding: "0 24px 8px" }}>
              <a href="/docs" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--sf-border)", textDecoration: "none", color: "inherit" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--sf-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <IconBook />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--sf-text)" }}>Kennisbank</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--sf-text-muted)", marginTop: 2 }}>Bekijk handleidingen, tutorials en veelgestelde vragen</p>
                </div>
                <IconExternalLink />
              </a>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--sf-surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <IconInbox />
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--sf-text)", flex: 1 }}>hallo@sequenceflow.io</p>
                <button
                  className="sf-btn sf-btn-secondary"
                  style={{ padding: "6px 14px", fontSize: 13 }}
                  onClick={() => { navigator.clipboard.writeText("hallo@sequenceflow.io"); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                >
                  {copied ? "Gekopieerd ✓" : "Kopiëren"}
                </button>
              </div>
            </div>

            <div className="sf-modal__footer">
              <a href="mailto:hallo@sequenceflow.io" className="sf-btn sf-btn-primary sf-btn--full" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}>
                <IconSend />
                E-mail sturen
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback modal ────────────────────────────────────── */}
      {feedbackOpen && (
        <div className="sf-modal-overlay" style={{ zIndex: 60 }} onClick={(e) => { if (e.target === e.currentTarget) { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackText(""); } }}>
          <div className="sf-modal" style={{ maxWidth: 440 }}>
            <div className="sf-modal__header">
              <div className="sf-modal__header-left">
                <div className="sf-modal__icon"><IconMessage /></div>
                <div>
                  <p className="sf-modal__title">Feedback of verzoek</p>
                  <p className="sf-modal__subtitle">Deel je idee of meld een probleem. We lezen alles.</p>
                </div>
              </div>
              <button className="sf-modal__close" onClick={() => { setFeedbackOpen(false); setFeedbackSent(false); setFeedbackText(""); }}><IconX /></button>
            </div>

            <div style={{ padding: "0 24px 8px" }}>
              {feedbackSent ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ fontSize: 32, margin: "0 0 12px" }}>✓</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--sf-text)", margin: "0 0 6px" }}>Bedankt voor je feedback!</p>
                  <p style={{ fontSize: 13, color: "var(--sf-text-muted)", margin: 0 }}>We nemen je bericht mee in de volgende update.</p>
                </div>
              ) : (
                <textarea
                  className="sf-textarea"
                  placeholder="Beschrijf je feedback of verzoek..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  style={{ width: "100%", minHeight: 120, resize: "vertical", boxSizing: "border-box" }}
                />
              )}
            </div>

            <div className="sf-modal__footer">
              {!feedbackSent ? (
                <button
                  className="sf-btn sf-btn-primary"
                  disabled={!feedbackText.trim()}
                  onClick={() => { setFeedbackSent(true); setFeedbackText(""); }}
                >
                  Versturen
                </button>
              ) : (
                <button className="sf-btn sf-btn-primary" onClick={() => { setFeedbackOpen(false); setFeedbackSent(false); }}>Sluiten</button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
