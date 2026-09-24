"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";

import { SequenceMark } from "@/components/marketing/SequenceMark";
import { createClient } from "@/lib/supabaseClient";

type Lang = "nl" | "en";

const T = {
  nl: {
    title: "Welkom terug",
    subtitle: "Log in bij Support One. Jouw klantvragen en antwoordconcepten staan klaar.",
    button: "Doorgaan met Google",
    footer: "Veilig inloggen via Google",
    signupTitle: "Start je gratis proefperiode",
    signupSubtitle: "Koppel je supportmailbox en probeer Support One 14 dagen. Geen creditcard nodig.",
    signupButton: "Start gratis met Google",
    signupFooter: "14 dagen gratis · 150 AI-antwoorden · geen creditcard",
    loginSwitch: "Nieuw bij Support One? Start gratis",
    signupSwitch: "Al een account? Log in",
    headline: ["Je AI-collega", "voor de supportinbox."],
    sub: "Support One bereidt antwoorden voor met jouw kennis en bestelgegevens. Jij beslist wat er wordt verstuurd.",
    questionLabel: "Klantvraag",
    customer: "Sanne de Vries",
    question: "Ik heb vorige week een dekbed besteld maar nog niets ontvangen. Kunnen jullie kijken waar hij is?",
    contextLabel: "Beschikbare context",
    context: ["Bestelling 1043 gevonden", "Verzonden met PostNL · bezorging morgen"],
    draftLabel: "Antwoordconcept",
    status: "Klaar voor controle",
    draft: "Hoi Sanne, je bestelling 1043 is gisteren met PostNL verzonden en wordt morgen bezorgd.",
  },
  en: {
    title: "Welcome back",
    subtitle: "Log in to Support One. Your customer questions and reply drafts are ready.",
    button: "Continue with Google",
    footer: "Secure sign-in via Google",
    signupTitle: "Start your free trial",
    signupSubtitle: "Connect your support mailbox and try Support One for 14 days. No credit card required.",
    signupButton: "Start free with Google",
    signupFooter: "14 days free · 150 AI answers · no credit card",
    loginSwitch: "New to Support One? Start free",
    signupSwitch: "Already have an account? Log in",
    headline: ["Your AI colleague", "for the support inbox."],
    sub: "Support One prepares replies with your knowledge and order data. You decide what gets sent.",
    questionLabel: "Customer question",
    customer: "Sanne de Vries",
    question: "I ordered a duvet last week but haven't received anything yet. Could you check where it is?",
    contextLabel: "Available context",
    context: ["Order 1043 found", "Shipped with PostNL · delivery tomorrow"],
    draftLabel: "Reply draft",
    status: "Ready for review",
    draft: "Hi Sanne, your order 1043 shipped yesterday with PostNL and will be delivered tomorrow.",
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
      background: "var(--sf-surface-2)",
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
            background: lang === l ? "var(--sf-green)" : "transparent",
            color: lang === l ? "var(--sf-dark)" : "var(--sf-text-muted)",
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

// Hetzelfde beeld als de demo op de landing: klantvraag, context, concept.
function MockTicket({ t }: { t: typeof T.nl }) {
  const label: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.42)", letterSpacing: "0.1em", textTransform: "uppercase" };
  return (
    <div style={{ width: "100%", maxWidth: 400, display: "grid", gap: 12 }}>
      <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "18px 20px" }}>
        <p style={label}>{t.questionLabel}</p>
        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#f2f2f2" }}>{t.customer}</p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(242,242,242,0.72)" }}>{t.question}</p>
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "14px 0" }} />
        <p style={label}>{t.contextLabel}</p>
        {t.context.map((fact) => (
          <p key={fact} style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 6px", fontSize: 13, color: "#f2f2f2" }}>
            <Check size={14} strokeWidth={3} style={{ flexShrink: 0, padding: 2, borderRadius: "50%", background: "rgba(199,245,111,0.14)", color: "#C7F56F" }} />{fact}
          </p>
        ))}
      </div>
      <div style={{ background: "#0a0a0a", border: "1px solid rgba(199,245,111,0.22)", borderRadius: 18, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <SequenceMark size={28} state="reading" title="" />
          <p style={{ ...label, margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.draftLabel}</p>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", border: "1px solid rgba(199,245,111,0.28)", background: "rgba(199,245,111,0.1)", color: "#C7F56F" }}>{t.status}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "rgba(242,242,242,0.8)" }}>{t.draft}</p>
      </div>
    </div>
  );
}

const STORAGE_KEY = "sf_lang";

function LoginContent() {
  const [lang, setLangState] = useState<Lang>("nl");
  const t = T[lang];
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const isSignup = searchParams.get("intent") === "signup";

  // Read persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== "nl" && stored !== "en") return;
    const timer = window.setTimeout(() => setLangState(stored), 0);
    return () => window.clearTimeout(timer);
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
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="sf-login-shell">
      <div className="sf-login-card">

        {/* ── Left panel: visual ── */}
        <div
          className="sf-login-image"
          style={{ background: "linear-gradient(160deg, #161616 0%, #0e0e0e 100%)" }}
        >
          {/* Glows */}
          <div style={{ position: "absolute", top: "-15%", right: "-10%", width: "60%", paddingBottom: "60%", borderRadius: "50%", background: "radial-gradient(circle, rgba(199,245,111,0.09) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-20%", left: "0%", width: "50%", paddingBottom: "50%", borderRadius: "50%", background: "radial-gradient(circle, rgba(199,245,111,0.06) 0%, transparent 65%)", pointerEvents: "none" }} />

          {/* Kop en voorbeeld in één kolom, zodat niets over elkaar valt. */}
          <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 24, overflow: "hidden" }}>
            <div>
              <p style={{ margin: "0 0 10px", color: "#fff", fontSize: 30, fontWeight: 500, lineHeight: 1.12, letterSpacing: "-0.03em" }}>{t.headline[0]}<br /><span style={{ color: "#C7F56F" }}>{t.headline[1]}</span></p>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.6, maxWidth: 360 }}>{t.sub}</p>
            </div>
            <MockTicket t={t} />
          </div>
        </div>

        {/* ── Right panel: form ── */}
        <div className="sf-login-form">

          {/* Logo — top of form panel */}
          <div style={{ position: "absolute", top: 22, left: 40, display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="SequenceFlow" style={{ height: 32, width: "auto", display: "block" }} />
            <span style={{ paddingLeft: 10, borderLeft: "1px solid var(--sf-border)", color: "var(--sf-text)", fontSize: 13, fontWeight: 600, lineHeight: "22px" }}>
              Support One
            </span>
          </div>

          {/* Lang switcher — top right */}
          <div style={{ position: "absolute", top: 24, right: 24 }}>
            <LangSwitch lang={lang} setLang={setLang} />
          </div>

          <div style={{ maxWidth: 320, width: "100%" }}>
            <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--sf-text)", margin: "0 0 8px" }}>
              {isSignup ? t.signupTitle : t.title}
            </h1>
            <p style={{ fontSize: 14, color: "var(--sf-text-muted)", margin: "0 0 28px", lineHeight: 1.55 }}>
              {isSignup ? t.signupSubtitle : t.subtitle}
            </p>

            {/* Google button */}
            <button className="sf-btn-google" onClick={handleGoogleLogin}>
              <GoogleIcon />
              {isSignup ? t.signupButton : t.button}
            </button>

            <p style={{ fontSize: 11, color: "var(--sf-text-subtle)", marginTop: 14, textAlign: "center" }}>
              {isSignup ? t.signupFooter : t.footer}
            </p>
            <p style={{ fontSize: 12, marginTop: 20, textAlign: "center" }}>
              <Link
                href={isSignup ? "/login" : "/login?intent=signup"}
                style={{ color: "var(--sf-text-muted)", fontWeight: 600 }}
              >
                {isSignup ? t.signupSwitch : t.loginSwitch}
              </Link>
            </p>
          </div>

          {/* Bottom footer */}
          <div style={{
            position: "absolute", bottom: 24, left: 0, right: 0,
            display: "flex", justifyContent: "center", alignItems: "center", gap: 16,
          }}>
            <span style={{ fontSize: 11, color: "var(--sf-text-subtle)" }}>
              SequenceFlow Support One
            </span>
            <Link href="/privacy" style={{ fontSize: 11, color: "var(--sf-text-subtle)", textDecoration: "underline" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" style={{ fontSize: 11, color: "var(--sf-text-subtle)", textDecoration: "underline" }}>
              Terms of Service
            </Link>
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
