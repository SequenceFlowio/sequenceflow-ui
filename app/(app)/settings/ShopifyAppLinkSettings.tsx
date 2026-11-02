"use client";

import { Copy, KeyRound, Unplug } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfirmDialog, Notice, Section } from "./SettingsUi";
import { StatusPill, commerceButtonStyle } from "./CommerceIntegrationUi";

type Status = {
  enabled: boolean;
  linkedShop?: string | null;
  linkedStatus?: string | null;
  hasStripeSubscription?: boolean;
};

/**
 * Een bestaande werkruimte aan de Shopify-app koppelen. De beheerder maakt hier
 * een eenmalige code en vult die in de app in Shopify in; zo krijgt de winkel
 * deze werkruimte (kennis, antwoordstijl, mailbox) in plaats van een lege.
 * Onzichtbaar zolang de Shopify-app niet aanstaat.
 */
export default function ShopifyAppLinkSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [unlinked, setUnlinked] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/shopify/link-code", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { enabled: false })
      .then((data: Status) => { if (active) setStatus(data); })
      .catch(() => { if (active) setStatus({ enabled: false }); });
    return () => { active = false; };
  }, []);

  if (!status?.enabled) return null;

  async function createCode() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/shopify/link-code", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Er ging iets mis. Probeer het opnieuw.");
      setCode(data);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/shopify/link-code", { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Ontkoppelen is niet gelukt. Probeer het opnieuw.");
      setUnlinked(status?.linkedShop ?? null);
      setStatus((current) => current ? { ...current, linkedShop: null, linkedStatus: null } : current);
      setConfirmUnlink(false);
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : "Ontkoppelen is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const linked = Boolean(status.linkedShop);
  const expires = code ? new Intl.DateTimeFormat("nl-NL", { timeStyle: "short" }).format(new Date(code.expiresAt)) : "";

  return (
    <Section
      title="Shopify-app"
      description="Gebruik je SequenceFlow Support in Shopify? Koppel de app aan deze werkruimte, zodat je kennis, antwoordstijl en mailbox meegaan."
      status={linked
        ? <StatusPill tone={status.linkedStatus === "active" ? "success" : "neutral"} label={status.linkedStatus === "active" ? "Gekoppeld" : "Verwijderd uit Shopify"} />
        : <StatusPill tone="neutral" label="Niet gekoppeld" />}
    >
      {linked ? (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
          Deze werkruimte is gekoppeld aan <strong style={{ color: "var(--text)" }}>{status.linkedShop}</strong>.{status.linkedStatus === "active" ? " Je abonnement loopt via Shopify." : " De app is uit Shopify verwijderd; ontkoppel hem hier om een andere winkel te koppelen."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {unlinked ? (
            <Notice tone="success" title={`${unlinked} ontkoppeld`}>
              Bestellingen en voorraad uit deze winkel komen niet meer binnen. De app staat nog in Shopify: verwijder hem daar onder Apps als je niet meer via Shopify wilt betalen.
            </Notice>
          ) : null}
          <ol style={{ margin: 0, paddingLeft: 18, listStyle: "decimal", color: "var(--muted)", fontSize: 13, lineHeight: 1.8 }}>
            <li>Maak hieronder een koppelcode. Die werkt 15 minuten en één keer.</li>
            <li>Open SequenceFlow Support in je Shopify-beheer en kies <em>Bestaande werkruimte koppelen</em>.</li>
            <li>Vul de code in. Klaar: de app gebruikt vanaf dan deze werkruimte.</li>
          </ol>
          {status.hasStripeSubscription ? (
            <Notice tone="warning" title="Je betaalt nu via Stripe">
              Na het koppelen loopt je abonnement via Shopify. Zeg daarna je Stripe-abonnement op onder Instellingen → Abonnement → &ldquo;Stripe-abonnement opzeggen&rdquo;, zodat je niet dubbel betaalt.
            </Notice>
          ) : null}
          {code ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <code style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface-2, var(--surface))", color: "var(--text)", fontSize: 20, fontWeight: 600, letterSpacing: ".12em" }}>{code.code}</code>
              <button type="button" onClick={copyCode} style={commerceButtonStyle}><Copy size={14} />{copied ? "Gekopieerd" : "Kopiëren"}</button>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Geldig tot {expires}</span>
            </div>
          ) : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div>
            <button type="button" onClick={createCode} disabled={busy} style={commerceButtonStyle}>
              <KeyRound size={14} />{busy ? "Bezig…" : code ? "Nieuwe code maken" : "Koppelcode maken"}
            </button>
          </div>
        </div>
      )}
      {linked ? (
        <div style={{ display: "grid", gap: 10 }}>
          {error && !confirmUnlink ? <Notice tone="error">{error}</Notice> : null}
          <div>
            <button type="button" onClick={() => { setError(null); setConfirmUnlink(true); }} disabled={busy} style={{ ...commerceButtonStyle, color: "var(--tone-danger)" }}>
              <Unplug size={14} />Ontkoppelen
            </button>
          </div>
        </div>
      ) : null}
      {confirmUnlink ? (
        <ConfirmDialog
          title="Shopify ontkoppelen?"
          description={`${status.linkedShop} hoort dan niet meer bij deze werkruimte. Bestellingen en voorraad uit de winkel komen niet meer binnen en de bewaarde bestelgegevens worden verwijderd. Je kennis, mailbox en gesprekken blijven. De app blijft in Shopify staan tot je hem daar verwijdert.`}
          confirmLabel="Ontkoppelen"
          danger
          busy={busy}
          error={error}
          onCancel={() => setConfirmUnlink(false)}
          onConfirm={() => void unlink()}
        />
      ) : null}
    </Section>
  );
}
