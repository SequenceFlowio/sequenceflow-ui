"use client";

import { useState } from "react";
import { ShieldAlert, X } from "lucide-react";

export default function SpamControl({
  ticketId,
  senderEmail,
  language,
  canBlockFuture,
  initiallyOpen = false,
  onClose,
}: {
  ticketId: string;
  senderEmail: string;
  language: string;
  canBlockFuture: boolean;
  /** Vanuit het Meer-menu opent de keuze direct; sluiten geeft het menu terug. */
  initiallyOpen?: boolean;
  onClose?: () => void;
}) {
  const nl = language === "nl";
  const [open, setOpen] = useState(initiallyOpen);
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
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    padding: "9px 13px",
    fontSize: 13,
    fontWeight: 600,
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
    <div style={{ border: "1px solid rgba(245,158,11,.3)", borderRadius: 14, background: "rgba(245,158,11,.06)", padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <ShieldAlert size={17} style={{ marginTop: 1, color: "var(--tone-warning)", flex: "0 0 auto" }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            {nl ? "Spam uit je inbox halen?" : "Remove spam from your inbox?"}
          </p>
          <p style={{ margin: "4px 0 0", overflowWrap: "anywhere", fontSize: 12, lineHeight: 1.55, color: "var(--muted)" }}>
            {nl
              ? "Alleen de kopie in Support One verhuist naar Spam. De originele mail blijft bij je mailprovider. Een ongebruikt antwoordconcept telt normaal niet mee voor je verbruik."
              : "Only the Support copy moves to Spam. The original stays with your email provider. Unedited AI usage is normally refunded; unusual patterns are reviewed."}
          </p>
          <p style={{ margin: "5px 0 0", overflowWrap: "anywhere", fontSize: 12, color: "var(--muted)" }}>
            {senderEmail}
          </p>
        </div>
        <button
          type="button"
          aria-label={nl ? "Sluiten" : "Close"}
          disabled={busy}
          onClick={() => { setOpen(false); setError(null); onClose?.(); }}
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
          style={{ ...buttonStyle, borderColor: "rgba(245,158,11,.35)", color: "var(--tone-warning)" }}
        >
          {nl ? "Ook deze afzender voortaan negeren" : "Also ignore this sender from now on"}
        </button>
      ) : null}
      {error ? <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--tone-danger)", lineHeight: 1.5 }}>{error}</p> : null}
    </div>
  );
}
