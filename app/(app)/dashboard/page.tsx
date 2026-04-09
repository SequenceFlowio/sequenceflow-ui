"use client";

import { useState, useEffect } from "react";
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

  // Animation state
  const [visibleEmails, setVisibleEmails] = useState(0);
  const [sentCount, setSentCount] = useState(12);
  const [aiDraftIdx, setAiDraftIdx] = useState(0);

  const EMAILS = [
    { from: "Sarah K.", subject: "Bestelstatus #4821?",     color: "#C7F56F" },
    { from: "Tom B.",   subject: "Retour aanvragen",        color: "#60a5fa" },
    { from: "Emma J.",  subject: "Factuur kwijt",           color: "#f9a8d4" },
    { from: "Rick M.",  subject: "Productvraag — maat XL",  color: "#fbbf24" },
    { from: "Lisa V.",  subject: "Leveringstijd?",          color: "#a78bfa" },
  ];

  const AI_DRAFTS = [
    "Beste Sarah, bedankt voor je bericht! Je bestelling #4821 is onderweg en arriveert morgen…",
    "Beste Tom, je retourverzoek is ontvangen. Stuur het product terug via het bijgevoegde label…",
    "Hallo Emma, ik stuur je de factuur direct opnieuw toe. Je vindt hem ook altijd in je account…",
    "Hi Rick, maat XL is beschikbaar! Ik heb hem voor je gereserveerd tot morgenavond…",
    "Beste Lisa, je pakket wordt verwacht binnen 2-3 werkdagen. Je ontvangt een track & trace…",
  ];

  // Email cascade: new email every 800ms, reset after all shown
  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleEmails(n => {
        if (n >= EMAILS.length) return 0;
        return n + 1;
      });
    }, 900);
    return () => clearInterval(timer);
  }, []);

  // AI draft cycles in sync with emails
  useEffect(() => {
    if (visibleEmails === 0) return;
    setAiDraftIdx((visibleEmails - 1) % AI_DRAFTS.length);
  }, [visibleEmails]);

  // Sent counter ticks up every ~3s
  useEffect(() => {
    const timer = setInterval(() => {
      setSentCount(n => n + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ minHeight: "100%", background: "var(--sf-bg)", overflowY: "auto" }}>

      {/* ── Hero ────────────────────────────────────────────── */}
      <div className="home-hero" style={{
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
      <div className="home-inbox" style={{ maxWidth: 680, margin: "0 auto 64px", padding: "0 32px" }}>
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

      {/* ── Section 1: How it works ─────────────────────────── */}
      <div className="home-section" style={{ maxWidth: 960, margin: "0 auto 80px", padding: "0 32px" }}>
        <style>{`
          @keyframes pulse-dot { 0%,100% { transform: scale(1); opacity:0.5; } 50% { transform: scale(1.5); opacity:1; } }
          @keyframes slideInEmail { from { opacity:0; transform:translateX(28px); } to { opacity:1; transform:translateX(0); } }
          @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
          @keyframes countUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
          .email-enter { animation: slideInEmail 0.4s cubic-bezier(0.34,1.4,0.64,1) both; }
          .draft-enter { animation: fadeInUp 0.35s ease both; }
          .count-enter { animation: countUp 0.3s ease both; }
          @media (max-width: 640px) {
            .home-hero { padding: 40px 16px 28px !important; }
            .home-hero h1 { font-size: 26px !important; }
            .home-hero p { font-size: 14px !important; }
            .home-inbox { padding: 0 16px !important; margin-bottom: 40px !important; }
            .home-section { padding: 0 16px !important; margin-bottom: 48px !important; }
            .home-grid-3col { grid-template-columns: 1fr !important; }
            .home-section-2 { padding: 40px 16px !important; margin-bottom: 40px !important; }
            .home-bottom { padding: 0 16px 40px !important; }
          }
        `}</style>

        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#3d6200", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>Hoe het werkt</p>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: "var(--sf-text)", margin: "0 0 12px", letterSpacing: "-0.02em" }}>Van inbox naar antwoord in seconden</h2>
          <p style={{ fontSize: 15, color: "var(--sf-text-muted)", margin: 0, maxWidth: 480, marginInline: "auto", lineHeight: 1.6 }}>Geen handmatig werk meer. SequenceFlow verwerkt elke email automatisch van begin tot eind.</p>
        </div>

        <div className="home-grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16 }}>

          {/* Step 1 — emails slide in */}
          <div style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#C7F56F", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#000", flexShrink: 0 }}>1</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--sf-text)" }}>Email binnenkomt</p>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--sf-text-muted)", lineHeight: 1.55 }}>Een klant stuurt een email naar je Gmail inbox. SequenceFlow detecteert hem direct.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 164, justifyContent: "flex-end" }}>
              {EMAILS.map((e, i) => (
                visibleEmails > i ? (
                  <div key={`${i}-${Math.floor(visibleEmails / EMAILS.length)}`} className="email-enter" style={{ background: "var(--sf-surface-2)", border: "1px solid var(--sf-border)", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: e.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#000", flexShrink: 0 }}>
                      {e.from[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--sf-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.subject}</p>
                      <p style={{ margin: 0, fontSize: 10, color: "var(--sf-text-subtle)" }}>{e.from}</p>
                    </div>
                    <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#C7F56F", flexShrink: 0, animation: "pulse-dot 1.5s ease infinite" }} />
                  </div>
                ) : (
                  <div key={i} style={{ height: 42, borderRadius: 8, background: "var(--sf-surface-2)", opacity: 0.2 }} />
                )
              ))}
            </div>
          </div>

          {/* Step 2 — AI writes */}
          <div style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#C7F56F", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#000", flexShrink: 0 }}>2</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--sf-text)" }}>AI analyseert & schrijft</p>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--sf-text-muted)", lineHeight: 1.55 }}>De AI bepaalt de intentie en schrijft een antwoord op basis van jouw kennisbank.</p>
            <div style={{ background: "var(--sf-surface-2)", border: "1px solid var(--sf-border)", borderRadius: 10, padding: 14, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "var(--sf-text-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>AI schrijft antwoord</p>
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  {[0, 0.18, 0.36].map((d, i) => (
                    <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#C7F56F", animation: `pulse-dot 1.1s ease-in-out ${d}s infinite` }} />
                  ))}
                </div>
              </div>
              <p key={aiDraftIdx} className="draft-enter" style={{ margin: 0, fontSize: 12, color: "var(--sf-text-muted)", lineHeight: 1.65, flex: 1 }}>
                {AI_DRAFTS[aiDraftIdx]}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Kennisbank ✓", "94% zekerheid", "Auto-send"].map(tag => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: "#3d6200", background: "rgba(199,245,111,0.25)", borderRadius: 99, padding: "2px 8px" }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3 — sent counter */}
          <div style={{ background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#C7F56F", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#000", flexShrink: 0 }}>3</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--sf-text)" }}>Verstuurd of goedgekeurd</p>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--sf-text-muted)", lineHeight: 1.55 }}>Met auto-send verstuurt de AI zelf. Of je keurt het concept goed met één klik.</p>
            {/* Live counter */}
            <div style={{ background: "rgba(199,245,111,0.1)", border: "1px solid rgba(199,245,111,0.3)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
              <p key={sentCount} className="count-enter" style={{ margin: "0 0 4px", fontSize: 36, fontWeight: 800, color: "var(--sf-text)", letterSpacing: "-0.03em" }}>{sentCount}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#3d6200", fontWeight: 600 }}>emails vandaag automatisch verzonden</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Bestelling #4821", time: "zojuist", color: "#C7F56F" },
                { label: "Retour aanvraag", time: "1 min geleden", color: "#60a5fa" },
                { label: "Factuurverzoek", time: "3 min geleden", color: "#a78bfa" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--sf-text-muted)", flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 10, color: "var(--sf-text-subtle)" }}>{item.time}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Section 2: Feature highlights ───────────────────── */}
      <div className="home-section-2" style={{ background: "var(--sf-surface)", borderTop: "1px solid var(--sf-border)", borderBottom: "1px solid var(--sf-border)", padding: "64px 32px", marginBottom: 64 }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#3d6200", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>Alles wat je nodig hebt</p>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: "var(--sf-text)", margin: "0 0 12px", letterSpacing: "-0.02em" }}>Gebouwd voor klantenservice teams</h2>
            <p style={{ fontSize: 15, color: "var(--sf-text-muted)", margin: 0, maxWidth: 440, marginInline: "auto", lineHeight: 1.6 }}>Alles op één plek — geen losse tools, geen handmatig kopiëren.</p>
          </div>

          <div className="home-grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 24 }}>
            {[
              {
                icon: "⚡",
                color: "#C7F56F",
                bg: "rgba(199,245,111,0.15)",
                title: "Auto-send",
                desc: "Stel vertrouwensdrempels in. Hoge-zekerheid emails worden automatisch verstuurd — de rest wacht op jouw goedkeuring.",
                stat: "2× per dag", statLabel: "automatische verzending",
              },
              {
                icon: "📚",
                color: "#60a5fa",
                bg: "rgba(96,165,250,0.12)",
                title: "Kennisbank",
                desc: "Upload handleidingen, FAQ's en beleidsdocumenten. De AI traint zichzelf op jouw content en antwoordt in jouw stijl.",
                stat: "100%", statLabel: "op maat van jouw merk",
              },
              {
                icon: "📊",
                color: "#a78bfa",
                bg: "rgba(167,139,250,0.12)",
                title: "Analytics",
                desc: "Zie hoe goed de AI presteert. Volg acceptatiepercentages, klantintentie en tijdsbesparing per week.",
                stat: "Real-time", statLabel: "inzicht in prestaties",
              },
            ].map(f => (
              <div key={f.title} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {f.icon}
                </div>
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--sf-text)" }}>{f.title}</p>
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--sf-text-muted)", lineHeight: 1.6 }}>{f.desc}</p>
                  <div style={{ borderTop: "1px solid var(--sf-border)", paddingTop: 12, display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "var(--sf-text)" }}>{f.stat}</span>
                    <span style={{ fontSize: 12, color: "var(--sf-text-subtle)" }}>{f.statLabel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom cards ────────────────────────────────────── */}
      <div className="home-bottom" style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 64px" }}>
        <div className="home-grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>

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

            <div style={{ padding: "20px 24px 8px" }}>
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
