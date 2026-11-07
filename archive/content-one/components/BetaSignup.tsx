"use client";

import { ArrowRight, Check } from "lucide-react";
import { useRef, useState } from "react";

/** Aanmelden voor de Content One-beta: alleen een e-mailadres, geen gesprek. */
export function BetaSignup() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const openedAt = useRef<number | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/marketing/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          company: form.get("company"),
          product: "content",
          page: window.location.pathname,
          elapsedMs: openedAt.current ? Date.now() - openedAt.current : 0,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Aanmelden is niet gelukt.");
      setState("sent");
    } catch (submitError) {
      setState("idle");
      setError(submitError instanceof Error ? submitError.message : "Aanmelden is niet gelukt.");
    }
  }

  if (state === "sent") {
    return <p className="h1-signup-done" role="status"><Check size={16} strokeWidth={3} /> Je staat op de lijst. We mailen je zodra de beta opengaat.</p>;
  }

  return (
    <form className="h1-signup" onSubmit={submit} onFocus={() => { if (openedAt.current === null) openedAt.current = Date.now(); }}>
      <label className="sr-only" htmlFor="h1-beta-email">E-mailadres</label>
      <div className="h1-signup-row">
        <input id="h1-beta-email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="jij@jouwwinkel.nl" />
        <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Bezig…" : <>Meld je aan <ArrowRight size={15} /></>}</button>
      </div>
      {/* Honeypot: mensen zien dit veld niet, bots vullen het wel in. */}
      <input className="h1-hp" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {error ? <small className="h1-signup-error" role="alert">{error}</small> : <small>Eerst toegang tot de beta. Geen spam.</small>}
    </form>
  );
}
