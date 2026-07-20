"use client";

import { useState } from "react";

export default function IgnoreSenderControl({ ticketId, senderEmail, language, canBlockFuture }: {
  ticketId: string;
  senderEmail: string;
  language: string;
  canBlockFuture: boolean;
}) {
  const nl = language === "nl";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ignore(blockFuture: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/ignore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockFuture }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (nl ? "Ticket archiveren mislukt." : "Could not archive ticket."));
      window.location.assign("/inbox");
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : (nl ? "Ticket archiveren mislukt." : "Could not archive ticket."));
      setBusy(false);
    }
  }

  const buttonStyle: React.CSSProperties = {
    minHeight: 40,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: busy ? "wait" : "pointer",
  };

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={buttonStyle}>{nl ? "Niet relevant" : "Not relevant"}</button>;
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", padding: 12, display: "grid", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "var(--text)" }}>{nl ? "Wat wil je doen?" : "What would you like to do?"}</p>
        <p style={{ margin: "4px 0 0", overflowWrap: "anywhere", fontSize: 11, lineHeight: 1.5, color: "var(--muted)" }}>{senderEmail}</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void ignore(false)} style={buttonStyle}>{nl ? "Archiveer alleen dit ticket" : "Archive this ticket"}</button>
      {canBlockFuture ? <button type="button" disabled={busy} onClick={() => void ignore(true)} style={{ ...buttonStyle, background: "rgba(251,191,36,0.10)", borderColor: "rgba(251,191,36,0.35)" }}>{nl ? "Archiveer + filter toekomstige mails" : "Archive + filter future mail"}</button> : null}
      <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null); }} style={{ ...buttonStyle, border: "none", color: "var(--muted)" }}>{nl ? "Annuleren" : "Cancel"}</button>
      {error ? <p role="alert" style={{ margin: 0, fontSize: 11, color: "#f87171", lineHeight: 1.5 }}>{error}</p> : null}
    </div>
  );
}
