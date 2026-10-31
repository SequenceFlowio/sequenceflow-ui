"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";

import { API_PATH, APP_PATH } from "@/lib/contentCalendar/paths";

function LoginForm() {
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch(`${API_PATH}/access/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (response.ok) {
      const next = params.get("next");
      window.location.href = next?.startsWith(`${APP_PATH}`) ? next : APP_PATH;
    } else {
      setError((await response.json().catch(() => ({}))).error ?? "Inloggen mislukt");
      setBusy(false);
    }
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <img src="/logo-black.png" alt="SequenceFlow" className="login-logo logo-light" />
      <img src="/logo-white.png" alt="SequenceFlow" className="login-logo logo-dark" />
      <h1>Je contentkalender, <em>geoptimaliseerd</em>.</h1>
      <p className="muted">Alleen voor SequenceFlow-admins.</p>
      <label className="field-label" htmlFor="code">Toegangscode</label>
      <div className="input-icon">
        <Lock size={15} />
        <input id="code" type="password" autoFocus autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <div className="banner error">{error}</div>}
      <button className="btn primary wide" disabled={busy || !code}>{busy ? "Bezig…" : <>Inloggen <ArrowRight size={16} /></>}</button>
    </form>
  );
}

export default function LoginPage() {
  return <main className="login-page"><Suspense><LoginForm /></Suspense></main>;
}
