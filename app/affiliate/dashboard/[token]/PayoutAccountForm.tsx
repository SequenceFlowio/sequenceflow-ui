"use client";

import { useState } from "react";

type Account = { accountHolder: string; ibanMasked: string };

/** Rekening waarop de commissie wordt uitbetaald. Het IBAN wordt versleuteld bewaard; hier staat alleen het eind ervan. */
export function PayoutAccountForm({ token, initial }: { token: string; initial: Account | null }) {
  const [account, setAccount] = useState<Account | null>(initial);
  const [editing, setEditing] = useState(!initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/affiliate/payout-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accountHolder: form.get("accountHolder"), iban: form.get("iban") }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Opslaan lukte niet.");
      setAccount(data.account);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opslaan lukte niet.");
    } finally {
      setBusy(false);
    }
  }

  if (account && !editing) {
    return (
      <div className="af-account">
        <p><span>Rekening</span><strong>{account.ibanMasked}</strong></p>
        <p><span>Op naam van</span><strong>{account.accountHolder}</strong></p>
        <button type="button" className="af-link" onClick={() => setEditing(true)}>Wijzigen</button>
      </div>
    );
  }

  return (
    <form className="af-account-form" onSubmit={submit} noValidate>
      <label><span>Naam rekeninghouder</span><input name="accountHolder" autoComplete="name" defaultValue={account?.accountHolder} required /></label>
      <label><span>IBAN</span><input name="iban" autoComplete="off" placeholder="NL00 BANK 0000 0000 00" required /></label>
      {error ? <p className="af-error" role="alert">{error}</p> : null}
      <div className="af-account-actions">
        <button className="mk-button mk-button--primary" disabled={busy}>{busy ? "Bezig…" : "Rekening opslaan"}</button>
        {account ? <button type="button" className="af-link" onClick={() => { setEditing(false); setError(null); }}>Annuleren</button> : null}
      </div>
    </form>
  );
}
