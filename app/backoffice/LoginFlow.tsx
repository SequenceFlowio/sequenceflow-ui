"use client";

import { useEffect, useRef, useState } from "react";

type Step = "email" | "code" | "enroll" | "totp";
type Reply = { ok: boolean; error?: string; step?: Step | "done"; factorId?: string; qr?: string; secret?: string };

async function call(body: Record<string, unknown>): Promise<Reply> {
  try {
    const response = await fetch("/api/backoffice/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await response.json() as Reply;
  } catch {
    return { ok: false, error: "Geen verbinding. Probeer het opnieuw." };
  }
}

/** Inloggen in twee stappen: code per e-mail, daarna de authenticator-app. */
export function LoginFlow({ initial, knownEmail }: { initial: "email" | "mfa"; knownEmail?: string }) {
  const [step, setStep] = useState<Step>(initial === "mfa" ? "totp" : "email");
  const [email, setEmail] = useState(knownEmail ?? "");
  const [code, setCode] = useState("");
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(initial === "mfa");
  const started = useRef(false);

  function apply(reply: Reply) {
    if (!reply.ok) return setError(reply.error ?? "Er ging iets mis.");
    setError(null);
    setCode("");
    if (reply.step === "done") return window.location.reload();
    if (reply.step === "enroll" && reply.factorId && reply.qr && reply.secret) setEnroll({ factorId: reply.factorId, qr: reply.qr, secret: reply.secret });
    if (reply.step) setStep(reply.step);
  }

  // Al ingelogd met de e-mailcode (bijvoorbeeld na 12 uur): alleen de authenticator opnieuw.
  useEffect(() => {
    if (initial !== "mfa" || started.current) return;
    started.current = true;
    void call({ action: "mfa_step" }).then((reply) => {
      setBusy(false);
      if (!reply.ok) { setStep("email"); return; }
      apply(reply);
    });
  }, [initial]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const reply = step === "email" ? await call({ action: "request_code", email })
      : step === "code" ? await call({ action: "verify_code", email, code })
      : await call({ action: "verify_totp", code, factorId: enroll?.factorId });
    setBusy(false);
    apply(reply);
  }

  const codeInput = (
    <input className="bo-input bo-input--code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={10} value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" autoFocus required aria-label="Code" />
  );

  return (
    <main className="bo-login">
      <form className="bo-login-card" onSubmit={submit}>
        <p className="bo-eyebrow">Alleen voor SequenceFlow</p>
        <h1>Beheer</h1>

        {step === "email" ? (
          <>
            <p className="bo-login-text">Vul je e-mailadres in. Je krijgt een eenmalige code per mail.</p>
            <input className="bo-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="naam@sequenceflow.io" autoFocus required aria-label="E-mailadres" />
          </>
        ) : null}

        {step === "code" ? (
          <>
            <p className="bo-login-text">Als <b>{email}</b> toegang heeft, staat er nu een code in die mailbox. Vul hem hier in.</p>
            {codeInput}
          </>
        ) : null}

        {step === "enroll" && enroll ? (
          <>
            <p className="bo-login-text">Eenmalig: koppel een authenticator-app (Google Authenticator, 1Password, Authy). Scan de code en vul de zes cijfers in die de app toont.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bo-qr" src={enroll.qr} alt="QR-code voor je authenticator-app" width={176} height={176} />
            <p className="bo-secret">Lukt scannen niet? Typ deze sleutel over:<code>{enroll.secret}</code></p>
            {codeInput}
          </>
        ) : null}

        {step === "totp" ? (
          <>
            <p className="bo-login-text">{busy && !code ? "Even controleren…" : "Vul de zes cijfers uit je authenticator-app in."}</p>
            {codeInput}
          </>
        ) : null}

        {error ? <p className="bo-login-error" role="alert">{error}</p> : null}
        <button className="bo-button" type="submit" disabled={busy}>
          {busy ? "Bezig…" : step === "email" ? "Stuur code" : step === "enroll" ? "Koppelen en inloggen" : "Verder"}
        </button>
        {step !== "email" ? (
          <button className="bo-link" type="button" onClick={() => { setStep("email"); setError(null); setCode(""); }}>Opnieuw beginnen</button>
        ) : null}
      </form>
    </main>
  );
}

export function LogoutButton() {
  return (
    <button className="bo-link" type="button" onClick={async () => { await call({ action: "logout" }); window.location.reload(); }}>
      Uitloggen
    </button>
  );
}
