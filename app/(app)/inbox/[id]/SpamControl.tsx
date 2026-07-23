"use client";

import { useState } from "react";
import { ShieldAlert, X } from "lucide-react";

export default function SpamControl({
  ticketId,
  senderEmail,
  language,
  canBlockFuture,
}: {
  ticketId: string;
  senderEmail: string;
  language: string;
  canBlockFuture: boolean;
}) {
  const nl = language === "nl";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markSpam(blockFuture: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/spam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spam: true, blockFuture }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || (nl ? "Markeren als spam mislukt." : "Could not mark as spam."));
      }
      window.location.assign("/inbox");
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : nl
            ? "Markeren als spam mislukt."
            : "Could not mark as spam.",
      );
      setBusy(false);
    }
  }

  const buttonStyle: React.CSSProperties = {
    minHeight: 42,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    padding: "9px 13px",
    fontSize: 12,
    fontWeight: 700,
    cursor: busy ? "wait" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={buttonStyle}>
        <ShieldAlert size={15} />
        {nl ? "Markeer als spam" : "Mark as spam"}
      </button>
    );
  }

  return (
    <div style={{ border: "1px solid rgba(245,158,11,.3)", borderRadius: 8, background: "rgba(245,158,11,.06)", padding: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <ShieldAlert size={17} style={{ marginTop: 1, color: "#b45309", flex: "0 0 auto" }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "var(--text)" }}>
            {nl ? "Spam uit je inbox halen?" : "Remove spam from your inbox?"}
          </p>
          <p style={{ margin: "4px 0 0", overflowWrap: "anywhere", fontSize: 11, lineHeight: 1.55, color: "var(--muted)" }}>
            {nl
              ? "Alleen de SequenceFlow-kopie verhuist naar Spam. De originele mail blijft bij je mailprovider. Onbewerkt AI-gebruik wordt normaal teruggeboekt; opvallende patronen worden gecontroleerd."
              : "Only the SequenceFlow copy moves to Spam. The original stays with your email provider. Unedited AI usage is normally refunded; unusual patterns are reviewed."}
          </p>
          <p style={{ margin: "5px 0 0", overflowWrap: "anywhere", fontSize: 10, color: "var(--muted)" }}>
            {senderEmail}
          </p>
        </div>
        <button
          type="button"
          aria-label={nl ? "Sluiten" : "Close"}
          disabled={busy}
          onClick={() => { setOpen(false); setError(null); }}
          style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 2 }}
        >
          <X size={15} />
        </button>
      </div>
      <button type="button" disabled={busy} onClick={() => void markSpam(false)} style={buttonStyle}>
        {busy ? (nl ? "Verplaatsen…" : "Moving…") : (nl ? "Alleen dit bericht" : "This message only")}
      </button>
      {canBlockFuture ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void markSpam(true)}
          style={{ ...buttonStyle, borderColor: "rgba(245,158,11,.35)", color: "#b45309" }}
        >
          {nl ? "Bericht + toekomstige afzender blokkeren" : "Message + block future sender"}
        </button>
      ) : null}
      {error ? <p role="alert" style={{ margin: 0, fontSize: 11, color: "#dc2626", lineHeight: 1.5 }}>{error}</p> : null}
    </div>
  );
}
