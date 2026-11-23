"use client";

import { useState } from "react";

import { Turnstile } from "@/components/Turnstile";

/**
 * Inloggen of aanmelden met e-mail, naast Google. Stap 1: e-mail (plus de
 * Turnstile-botcheck) → Supabase mailt een link en een code. Stap 2: de code
 * invullen, of op de link in de mail klikken. Nieuwe adressen krijgen meteen
 * een account, net als bij Google.
 */

const T = {
  nl: {
    email: "E-mailadres", placeholder: "jij@jouwwinkel.nl",
    send: "Doorgaan met e-mail", sending: "Versturen…",
    sentTitle: "Check je inbox",
    sent: (email: string) => `We hebben een mail gestuurd naar ${email}. Klik op de link, of vul hieronder de code uit de mail in.`,
    code: "Code uit de mail", verify: "Inloggen", verifying: "Controleren…",
    other: "Ander e-mailadres", resend: "Stuur opnieuw", resent: "Nieuwe mail verstuurd.",
    failed: "Dat lukte niet. Probeer het opnieuw of log in met Google.",
    spam: "Niets ontvangen? Kijk ook in je spammap.",
  },
  en: {
    email: "Email address", placeholder: "you@yourstore.com",
    send: "Continue with email", sending: "Sending…",
    sentTitle: "Check your inbox",
    sent: (email: string) => `We sent an email to ${email}. Click the link, or enter the code from the email below.`,
    code: "Code from the email", verify: "Log in", verifying: "Checking…",
    other: "Use another email", resend: "Send again", resent: "New email sent.",
    failed: "That didn't work. Try again or continue with Google.",
    spam: "Nothing yet? Check your spam folder too.",
  },
};

const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid var(--sf-border)", background: "transparent", color: "var(--sf-text)", fontSize: 14, fontFamily: "inherit" };
const primary: React.CSSProperties = { width: "100%", height: 44, marginTop: 10, borderRadius: 12, border: 0, background: "var(--sf-green, #C7F56F)", color: "#152000", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const link: React.CSSProperties = { padding: 0, border: 0, background: "none", color: "var(--sf-text-muted)", fontSize: 12, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" };

export function EmailLogin({ lang, next, beforeStart }: {
  lang: "nl" | "en";
  next: string;
  /** Bijvoorbeeld de partnercode eerst toepassen; false = niet doorgaan. */
  beforeStart?: () => Promise<boolean>;
}) {
  const t = T[lang];
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, lang, next }) });
    const data = await response.json().catch(() => ({})) as { error?: string; next?: string };
    if (!response.ok) throw new Error(data.error || t.failed);
    return data;
  }

  async function send(address: string) {
    if (beforeStart && !(await beforeStart())) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await post("/auth/email/start", { email: address, captchaToken: captcha });
      if (sentTo) setNotice(t.resent);
      setSentTo(address.trim().toLowerCase());
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : t.failed);
    } finally {
      setBusy(false);
      // Elk token is één keer bruikbaar; ook een geslaagde poging verbruikt het.
      setCaptchaReset((value) => value + 1);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const data = await post("/auth/email/verify", { email: sentTo, code });
      window.location.assign(data.next || next);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : t.failed);
      setBusy(false);
    }
  }

  const message = error ? <p role="alert" style={{ color: "var(--sf-danger, #f87171)", fontSize: 13, lineHeight: 1.5, margin: "10px 0 0" }}>{error}</p>
    : notice ? <p role="status" style={{ color: "var(--tone-success, #C7F56F)", fontSize: 13, margin: "10px 0 0" }}>{notice}</p> : null;

  if (sentTo) {
    return (
      <form onSubmit={(event) => { event.preventDefault(); void verify(); }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--sf-text)" }}>{t.sentTitle}</p>
        <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55, color: "var(--sf-text-muted)" }}>{t.sent(sentTo)}</p>
        <label htmlFor="login-code" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sf-text-muted)", marginBottom: 6 }}>{t.code}</label>
        <input id="login-code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="123456" autoFocus
          style={{ ...input, fontSize: 18, letterSpacing: "0.3em", textAlign: "center" }} />
        <button type="submit" disabled={busy || code.replace(/\s/g, "").length < 6} style={{ ...primary, opacity: busy || code.replace(/\s/g, "").length < 6 ? 0.6 : 1 }}>{busy ? t.verifying : t.verify}</button>
        {message}
        <Turnstile onToken={setCaptcha} resetKey={captchaReset} lang={lang} />
        <p style={{ display: "flex", justifyContent: "space-between", gap: 12, margin: "14px 0 0" }}>
          <button type="button" style={link} onClick={() => { setSentTo(null); setCode(""); setError(null); setNotice(null); }}>{t.other}</button>
          <button type="button" style={link} disabled={busy} onClick={() => void send(sentTo)}>{t.resend}</button>
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--sf-text-subtle)", textAlign: "center" }}>{t.spam}</p>
      </form>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void send(email); }}>
      <label htmlFor="login-email" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--sf-text-muted)", marginBottom: 6 }}>{t.email}</label>
      <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={200} placeholder={t.placeholder} style={input} />
      <Turnstile onToken={setCaptcha} resetKey={captchaReset} lang={lang} />
      <button type="submit" disabled={busy || !email.includes("@")} style={{ ...primary, opacity: busy || !email.includes("@") ? 0.6 : 1 }}>{busy ? t.sending : t.send}</button>
      {message}
    </form>
  );
}
