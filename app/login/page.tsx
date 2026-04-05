"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabaseClient";

type Lang = "nl" | "en";

const T = {
  nl: {
    title: "Welkom terug",
    subtitle: "Log in op je SequenceFlow account en beheer je klantenservice op autopilot.",
    button: "Doorgaan met Google",
    footer: "Veilige authenticatie via Google",
    emailPlaceholder: "jij@bedrijf.nl",
    passwordPlaceholder: "••••••••",
    comingSoon: "Binnenkort beschikbaar",
    orDivider: "Of",
    headline: ["Elk ticket.", "Afgehandeld."],
    sub: "Van inbox naar antwoord — geclassificeerd, geconcept en beleidsgetoetst in seconden.",
    ticketLabel: "Inkomend ticket",
    customer: "Jan de Vries",
    subject: "Bestelling #4521 niet ontvangen",
    intent: "bestelstatus",
    conf: "91%",
    status: "Concept klaar",
    draftLabel: "AI Concept",
    draft: "Beste Jan, hartelijk dank voor uw bericht. We begrijpen dat u bezorgd bent over uw bestelling #4521. We hebben dit intern gecheckt en uw pakket wordt vandaag nog verzonden.",
    chips: ["Intentherkenning", "Auto-concept replies", "Beleidsbewust"],
  },
  en: {
    title: "Welcome back",
    subtitle: "Log in to your SequenceFlow account and manage your customer support on autopilot.",
    button: "Continue with Google",
    footer: "Secure authentication via Google",
    emailPlaceholder: "you@company.com",
    passwordPlaceholder: "••••••••",
    comingSoon: "Coming Soon",
    orDivider: "Or",
    headline: ["Every ticket.", "Handled."],
    sub: "From inbox to reply — classified, drafted and policy-checked in seconds.",
    ticketLabel: "Incoming ticket",
    customer: "Jan de Vries",
    subject: "Order #4521 has not arrived",
    intent: "order status",
    conf: "91%",
    status: "Draft Ready",
    draftLabel: "AI Draft",
    draft: "Dear Jan, thank you for your message. We understand you are concerned about order #4521. We have checked internally and your package will be shipped today.",
    chips: ["Intent classification", "Auto-draft replies", "Policy-aware"],
  },
};

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div style={{
      display: "flex",
      gap: "2px",
      background: "#F3F4F6",
      borderRadius: "8px",
      padding: "3px",
    }}>
      {(["nl", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding: "4px 10px",
            borderRadius: "5px",
            border: "none",
            background: lang === l ? "#1a1a1a" : "transparent",
            color: lang === l ? "#F9FAFB" : "#9CA3AF",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            transition: "all 0.12s ease",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function MockTicket({ t }: { t: typeof T.nl }) {
  return (
    <div style={{
      width: "100%",
      maxWidth: "400px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "14px",
      padding: "20px 22px",
    }}>
      {/* Card header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <span style={{
          fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          {t.ticketLabel}
        </span>
        <span style={{
          fontSize: "11px", fontWeight: 600, padding: "2px 9px",
          borderRadius: "6px", background: "rgba(199,245,111,0.14)",
          color: "#C7F56F", letterSpacing: "0.02em",
        }}>
          {t.status}
        </span>
      </div>

      {/* Customer + subject */}
      <p style={{ fontSize: "13px", fontWeight: 600, color: "#E5E7EB", margin: "0 0 3px" }}>
        {t.customer}
      </p>
      <p style={{ fontSize: "12px", color: "rgba(229,231,235,0.4)", margin: "0 0 12px" }}>
        {t.subject}
      </p>

      {/* Badges */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "5px", background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
          {t.intent}
        </span>
        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "5px", background: "rgba(199,245,111,0.12)", color: "#C7F56F" }}>
          {t.conf}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", marginBottom: "14px" }} />

      {/* AI Draft */}
      <p style={{
        fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.28)",
        letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px",
      }}>
        {t.draftLabel}
      </p>
      <p style={{ fontSize: "13px", color: "rgba(229,231,235,0.55)", lineHeight: 1.65, margin: 0 }}>
        {t.draft}
      </p>
    </div>
  );
}

const STORAGE_KEY = "sf_lang";

function LoginContent() {
  const [lang, setLangState] = useState<Lang>("nl");
  const t = T[lang];
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/inbox";

  // Read persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "nl" || stored === "en") setLangState(stored);
  }, []);

  // Write to localStorage so LanguageProvider picks it up after login
  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://emailreply.sequenceflow.io").replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="sf-login-shell">
      <div className="sf-login-card">

        {/* ── Left panel: visual ── */}
        <div
          className="sf-login-image"
          style={{ background: "linear-gradient(145deg, #0d1117 0%, #0f172a 45%, #1a1a2e 100%)" }}
        >
          {/* Glows */}
          <div style={{ position: "absolute", top: "-15%", right: "-10%", width: "60%", paddingBottom: "60%", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-20%", left: "0%", width: "50%", paddingBottom: "50%", borderRadius: "50%", background: "radial-gradient(circle, rgba(199,245,111,0.06) 0%, transparent 65%)", pointerEvents: "none" }} />

          {/* Headline overlay */}
          <div className="sf-login-image__headline">
            <p>{t.headline[0]}<br /><span style={{ color: "#C7F56F" }}>{t.headline[1]}</span></p>
            <p>{t.sub}</p>
          </div>

          {/* Mock ticket — centered */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "100px 24px 24px" }}>
            <MockTicket t={t} />
          </div>

          {/* Feature chips — bottom */}
          <div style={{ position: "absolute", bottom: 20, left: 20, right: 20, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {t.chips.map((chip) => (
              <span key={chip} style={{ fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(229,231,235,0.45)" }}>
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right panel: form ── */}
        <div className="sf-login-form">

          {/* Logo — top of form panel */}
          <div style={{ position: "absolute", top: 24, left: 40, display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/logo-black.png" alt="SequenceFlow" width={160} height={40} priority style={{ height: 32, width: "auto" }} className="block dark:hidden" />
            <Image src="/logo-white.png" alt="SequenceFlow" width={160} height={40} priority style={{ height: 32, width: "auto" }} className="hidden dark:block" />
          </div>

          {/* Lang switcher — top right */}
          <div style={{ position: "absolute", top: 24, right: 24 }}>
            <LangSwitch lang={lang} setLang={setLang} />
          </div>

          <div style={{ maxWidth: 320, width: "100%" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--sf-text)", margin: "0 0 8px" }}>
              {t.title}
            </h1>
            <p style={{ fontSize: 14, color: "var(--sf-text-muted)", margin: "0 0 28px", lineHeight: 1.55 }}>
              {t.subtitle}
            </p>

            {/* Email — disabled */}
            <div className="sf-field">
              <label className="sf-label">E-mailadres</label>
              <input
                className="sf-input"
                type="email"
                placeholder={t.emailPlaceholder}
                disabled
                style={{ opacity: 0.45, cursor: "not-allowed" }}
              />
            </div>

            {/* Password — disabled */}
            <div className="sf-field" style={{ marginBottom: 20 }}>
              <label className="sf-label">Wachtwoord</label>
              <input
                className="sf-input"
                type="password"
                placeholder={t.passwordPlaceholder}
                disabled
                style={{ opacity: 0.45, cursor: "not-allowed" }}
              />
            </div>

            {/* Coming soon button — disabled */}
            <button
              className="sf-btn sf-btn-dark sf-btn--full"
              disabled
              style={{ opacity: 0.5, cursor: "not-allowed", marginBottom: 0 }}
            >
              {t.comingSoon}
            </button>

            {/* Divider */}
            <div className="sf-divider">
              <span>{t.orDivider}</span>
            </div>

            {/* Google button */}
            <button className="sf-btn-google" onClick={handleGoogleLogin}>
              <GoogleIcon />
              {t.button}
            </button>

            <p style={{ fontSize: 11, color: "var(--sf-text-subtle)", marginTop: 14, textAlign: "center" }}>
              {t.footer}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
