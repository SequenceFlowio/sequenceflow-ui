"use client";

import { useState } from "react";
import type { TicketBlockingAction, TicketCommerceContext, OperationalTimelineItem } from "@/types/aiInbox";

function safeTrackingUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export default function CommercePanel({ ticketId, context, action, timeline, language, canAdminister }: {
  ticketId: string;
  context: TicketCommerceContext | null | undefined;
  action: TicketBlockingAction | null | undefined;
  timeline: OperationalTimelineItem[] | undefined;
  language: string;
  canAdminister: boolean;
}) {
  const nl = language === "nl";
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!context) return null;

  async function mutate(key: string, url: string, init: RequestInit = { method: "POST" }, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key); setError(null);
    try {
      const response = await fetch(url, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (nl ? "Actie mislukt." : "Action failed."));
      window.location.reload();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : (nl ? "Actie mislukt." : "Action failed."));
      setBusy(null);
    }
  }

  const order = context.order;
  const providerLabel = context.provider === "woocommerce" ? "WooCommerce" : "Shopify";
  return (
    <section style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div><p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "var(--muted)" }}>Commerce context</p><p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{providerLabel}</p></div>
        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--tone-success-strong)" }}>{context.connectionStatus}</span>
      </div>
      <div style={{ padding: 16, display: "grid", gap: 14 }}>
        {!order && context.candidates.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
              {context.candidates.length === 1
                ? (nl
                    ? "Ordernummer gevonden, maar de klantidentiteit kon niet automatisch worden bevestigd. Controleer de order en koppel hem handmatig."
                    : "Order number found, but the customer identity could not be verified automatically. Check the order and link it manually.")
                : (nl ? "Meerdere orders gevonden. Kies de juiste order." : "Multiple orders found. Select the correct order.")}
            </p>
            {context.candidates.map((candidate) => (
              <button type="button" key={candidate.id} disabled={Boolean(busy)} onClick={() => mutate(candidate.id, `/api/tickets/${ticketId}/commerce-context`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: candidate.id }) })} style={{ minHeight: 42, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", padding: "8px 12px", display: "flex", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
                <span style={{ fontWeight: 750 }}>{candidate.displayName}</span><span style={{ color: "var(--muted)" }}>{candidate.totalAmount} {candidate.currencyCode}</span>
              </button>
            ))}
          </div>
        ) : order ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
              {[{ label: nl ? "Order" : "Order", value: order.displayName }, { label: nl ? "Bedrag" : "Amount", value: `${order.totalAmount} ${order.currencyCode}` }, { label: "Fulfillment", value: order.fulfillmentStatus || "unknown" }, { label: nl ? "Betaling" : "Payment", value: order.financialStatus || "unknown" }].map((field) => <div key={field.label}><p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>{field.label}</p><p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{field.value}</p></div>)}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" disabled={Boolean(busy)} onClick={() => mutate("refresh", `/api/tickets/${ticketId}/commerce-context`, { method: "PATCH" })} style={{ minHeight: 36, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", padding: "0 12px", fontSize: 11, fontWeight: 750, cursor: "pointer" }}>{busy === "refresh" ? (nl ? "Verversen…" : "Refreshing…") : (nl ? "Live verversen" : "Refresh live")}</button>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{providerLabel} · {new Date(order.lastSyncedAt).toLocaleString()} · {order.matchMethod.replace(/_/g, " ")} · {Math.round(order.matchConfidence * 100)}%</span>
            </div>
            {order.items.length ? <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>{order.items.map((item) => `${item.quantity}× ${item.title}${item.sku ? ` (${item.sku})` : ""}`).join(", ")}</p> : null}
            {order.fulfillments.length ? <div style={{ display: "grid", gap: 5 }}>{order.fulfillments.map((fulfillment) => (
              <p key={fulfillment.id} style={{ margin: 0, fontSize: 11, color: "var(--muted)", overflowWrap: "anywhere" }}>
                {[fulfillment.status, fulfillment.trackingCompany, fulfillment.trackingNumber].filter(Boolean).join(" · ")}
                {safeTrackingUrl(fulfillment.trackingUrl) ? <> · <a href={safeTrackingUrl(fulfillment.trackingUrl)!} target="_blank" rel="noreferrer" style={{ color: "var(--text)" }}>{nl ? "Volgen" : "Track"}</a></> : null}
              </p>
            ))}</div> : null}
          </>
        ) : <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{nl ? "Geen order ondubbelzinnig gekoppeld." : "No order was linked unambiguously."}</p>}

        {action ? (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{nl ? "Order annuleren" : "Cancel order"}</p><p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{action.rationale}</p></div><span style={{ fontSize: 10, fontWeight: 800, color: action.status === "succeeded" ? "var(--tone-success-strong)" : action.status === "failed" || action.status === "blocked" ? "#f87171" : "#a16207" }}>{action.status}</span></div>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>{nl ? "Refund naar oorspronkelijke betaalmethode · voorraad restocken · geen dubbele provider-mail" : "Refund original payment · restock inventory · no duplicate provider email"}</p>
            {action.lastError ? <p style={{ margin: 0, fontSize: 11, color: "#f87171" }}>{action.lastError}</p> : null}
            {action.status === "succeeded" && action.confirmationStatus !== "prepared" ? (
              <p style={{ margin: 0, fontSize: 11, color: action.confirmationStatus === "failed" ? "#f87171" : "var(--muted)", lineHeight: 1.5 }}>
                {action.confirmationStatus === "failed"
                  ? action.confirmationError || (nl ? "Het bevestigingsconcept kon niet worden gemaakt." : "The confirmation draft could not be prepared.")
                  : (nl ? "Annulering gelukt. Het bevestigingsconcept wordt voorbereid en blijft geblokkeerd tot menselijke controle." : "Cancellation succeeded. The confirmation draft is being prepared and remains blocked until human review.")}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {canAdminister && action.status === "proposed" ? <button type="button" disabled={Boolean(busy)} onClick={() => mutate("approve", `/api/commerce-actions/${action.id}/approve`, { method: "POST" }, nl ? `Annulering van ${action.orderDisplayName} (${action.totalAmount} ${action.currencyCode}) is onomkeerbaar. Refund naar de oorspronkelijke betaalmethode en voorraad restocken. Doorgaan?` : `Cancellation of ${action.orderDisplayName} (${action.totalAmount} ${action.currencyCode}) is irreversible. Refund the original payment method and restock inventory. Continue?`)} style={{ minHeight: 40, borderRadius: 8, border: "none", background: "#C7F56F", color: "#0f1a00", padding: "0 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{busy === "approve" ? (nl ? "Uitvoeren…" : "Executing…") : (nl ? "Goedkeuren en uitvoeren" : "Approve and execute")}</button> : null}
              {canAdminister && action.status === "failed" ? <button type="button" disabled={Boolean(busy)} onClick={() => mutate("retry", `/api/commerce-actions/${action.id}/retry`, { method: "POST" }, nl ? "Annulering opnieuw proberen?" : "Retry cancellation?")} style={{ minHeight: 40, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", padding: "0 14px", fontSize: 12, fontWeight: 750, cursor: "pointer" }}>{nl ? "Opnieuw proberen" : "Retry"}</button> : null}
              {canAdminister && action.status === "succeeded" && action.confirmationStatus === "failed" ? <button type="button" disabled={Boolean(busy)} onClick={() => mutate("retry-confirmation", `/api/commerce-actions/${action.id}/retry`, { method: "POST" })} style={{ minHeight: 40, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", padding: "0 14px", fontSize: 12, fontWeight: 750, cursor: "pointer" }}>{nl ? "Bevestiging opnieuw maken" : "Retry confirmation"}</button> : null}
              {canAdminister && ["proposed", "failed", "blocked"].includes(action.status) ? <button type="button" disabled={Boolean(busy)} onClick={() => mutate("reject", `/api/commerce-actions/${action.id}/reject`, { method: "POST" })} style={{ minHeight: 40, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", padding: "0 14px", fontSize: 12, fontWeight: 750, cursor: "pointer" }}>{nl ? "Afwijzen en handmatig oplossen" : "Reject and resolve manually"}</button> : null}
            </div>
            {!canAdminister && ["proposed", "failed", "blocked"].includes(action.status) ? <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>{nl ? "Alleen een tenant-admin kan deze actie beoordelen." : "Only a tenant admin can review this action."}</p> : null}
          </div>
        ) : null}

        {timeline?.length ? <details style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}><summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 750, color: "var(--muted)" }}>{nl ? "Operationele timeline" : "Operational timeline"}</summary><div style={{ display: "grid", gap: 7, marginTop: 10 }}>{timeline.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11 }}><span style={{ color: "var(--text)" }}>{item.label}</span><span style={{ color: "var(--muted)" }}>{new Date(item.occurredAt).toLocaleString()}</span></div>)}</div></details> : null}
        {error ? <p role="alert" style={{ margin: 0, fontSize: 11, color: "#f87171" }}>{error}</p> : null}
      </div>
    </section>
  );
}
