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

function fulfilmentLabel(status: string | null, nl: boolean) {
  if (!status) return nl ? "Onbekend" : "Unknown";
  const labels: Record<string, string> = nl
    ? { OPEN: "Nog niet verzonden", SHIPPED: "Verzonden", PARTIALLY_SHIPPED: "Deels verzonden", CANCELLED: "Geannuleerd", fulfilled: "Verzonden", unfulfilled: "Nog niet verzonden", partial: "Deels verzonden" }
    : { OPEN: "Not shipped yet", SHIPPED: "Shipped", PARTIALLY_SHIPPED: "Partially shipped", CANCELLED: "Cancelled", fulfilled: "Shipped", unfulfilled: "Not shipped yet", partial: "Partially shipped" };
  return labels[status] ?? status;
}

type PendingConfirm = { key: string; url: string; init: RequestInit; text: string };

/**
 * Alle bestelgegevens bij een klantvraag. De detailpagina toont de
 * belangrijkste feiten al als context; dit paneel is de volledige weergave
 * en de plek voor handmatig koppelen en (goedgekeurde) annuleringen.
 */
export default function CommercePanel({ ticketId, context, action, timeline, language, canAdminister, onChanged }: {
  ticketId: string;
  context: TicketCommerceContext | null | undefined;
  action: TicketBlockingAction | null | undefined;
  timeline: OperationalTimelineItem[] | undefined;
  language: string;
  canAdminister: boolean;
  onChanged: () => Promise<void>;
}) {
  const nl = language === "nl";
  const locale = nl ? "nl-NL" : "en-GB";
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Onomkeerbare acties vragen bevestiging in de pagina zelf, niet via window.confirm.
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  if (!context) return null;

  async function mutate(key: string, url: string, init: RequestInit = { method: "POST" }, confirmText?: string) {
    if (confirmText) {
      setPendingConfirm({ key, url, init, text: confirmText });
      return;
    }
    setBusy(key); setError(null);
    try {
      const response = await fetch(url, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (nl ? "Actie mislukt." : "Action failed."));
      await onChanged();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : (nl ? "Actie mislukt." : "Action failed."));
    } finally {
      setBusy(null);
    }
  }

  const order = context.order;
  const providerLabel = context.provider === "bol" ? "bol.com" : context.provider === "woocommerce" ? "WooCommerce" : "Shopify";
  const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency: currency || "EUR" }).format(amount);
  return (
    <div className="td-commerce">
      {!order && context.candidates.length > 0 ? (
        <div className="td-commerce-block">
          <p className="td-commerce-note">
            {context.candidates.length === 1
              ? (nl
                  ? "Ordernummer gevonden, maar de klant kon niet automatisch worden bevestigd. Controleer de bestelling en koppel hem zelf."
                  : "Order number found, but the customer identity could not be verified automatically. Check the order and link it manually.")
              : (nl ? "Meerdere bestellingen gevonden. Kies de juiste." : "Multiple orders found. Select the correct order.")}
          </p>
          {context.candidates.map((candidate) => (
            <button type="button" className="td-commerce-candidate" key={candidate.id} disabled={Boolean(busy)} onClick={() => mutate(candidate.id, `/api/tickets/${ticketId}/commerce-context`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: candidate.id }) })}>
              <strong>{candidate.displayName}</strong><span>{money(candidate.totalAmount, candidate.currencyCode)}</span>
            </button>
          ))}
        </div>
      ) : order ? (
        <>
          <dl className="td-commerce-fields">
            {[
              { label: nl ? "Bestelling" : "Order", value: order.displayName },
              { label: nl ? "Besteld op" : "Ordered", value: new Date(order.orderCreatedAt).toLocaleDateString(locale) },
              { label: nl ? "Bedrag" : "Amount", value: money(order.totalAmount, order.currencyCode) },
              { label: nl ? "Afhandeling" : "Fulfilment", value: fulfilmentLabel(order.fulfillmentStatus, nl) },
            ].map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}
          </dl>
          {order.items.length ? <div className="td-commerce-list">{order.items.map((item) => <div key={item.id}>
            <strong>{item.quantity}× {item.title}</strong>
            <span>{[
              item.ean ? `EAN ${item.ean}` : null,
              item.latestDeliveryAt ? `${nl ? "Bezorgbelofte" : "Delivery promise"} ${new Date(item.latestDeliveryAt).toLocaleDateString(locale)}` : null,
              item.cancellationRequested ? (nl ? "Annuleringsverzoek ontvangen" : "Cancellation requested") : null,
            ].filter(Boolean).join(" · ")}</span>
          </div>)}</div> : null}
          {order.fulfillments.length ? <div className="td-commerce-list">{order.fulfillments.map((fulfillment) => (
            <div key={fulfillment.id}>
              <strong>{[fulfillment.trackingCompany, fulfillment.transportStatusDescription || fulfillment.status].filter(Boolean).join(" · ") || (nl ? "Verzending" : "Shipment")}</strong>
              <span>{fulfillment.trackingNumber}{safeTrackingUrl(fulfillment.trackingUrl) ? <> · <a href={safeTrackingUrl(fulfillment.trackingUrl)!} target="_blank" rel="noreferrer">{nl ? "Volgen" : "Track"}</a></> : null}</span>
            </div>
          ))}</div> : null}
          {order.returns.length ? <div className="td-commerce-list">{order.returns.map((returnItem) => <div key={returnItem.id}>
            <strong>{nl ? "Retour" : "Return"} {returnItem.externalId} · {returnItem.handled ? (nl ? "verwerkt" : "processed") : (nl ? "aangemeld" : "registered")}</strong>
            <span>{returnItem.items.map((item) => `${item.title || item.ean || item.externalId} · ${item.handled ? (item.handlingResult || (nl ? "ontvangen" : "received")) : (nl ? "onderweg" : "in transit")}`).join(" · ")}</span>
          </div>)}</div> : null}
          <div className="td-commerce-foot">
            <button type="button" className="td-btn" disabled={Boolean(busy)} onClick={() => mutate("refresh", `/api/tickets/${ticketId}/commerce-context`, { method: "PATCH" })}>{busy === "refresh" ? (nl ? "Bijwerken…" : "Updating…") : (nl ? "Nu bijwerken" : "Update now")}</button>
            <span>{providerLabel} · {nl ? "bijgewerkt" : "updated"} {new Date(order.lastSyncedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </>
      ) : <p className="td-commerce-note">{nl ? "Geen bestelling eenduidig gekoppeld." : "No order was linked unambiguously."}</p>}

      {action ? (
        <div className="td-commerce-block td-commerce-action">
          <div className="td-commerce-action-head">
            <div><strong>{nl ? "Bestelling annuleren" : "Cancel order"}</strong><p>{action.rationale}</p></div>
            <span className={`td-pill ${action.status === "succeeded" ? "good" : action.status === "failed" || action.status === "blocked" ? "bad" : "warn"}`}>{action.status}</span>
          </div>
          <p className="td-commerce-note">{nl ? "Terugbetaling naar de oorspronkelijke betaalmethode · voorraad terugzetten · geen dubbele mail van de winkel" : "Refund original payment · restock inventory · no duplicate provider email"}</p>
          {action.lastError ? <p className="td-commerce-error">{action.lastError}</p> : null}
          {action.status === "succeeded" && action.confirmationStatus !== "prepared" ? (
            <p className={action.confirmationStatus === "failed" ? "td-commerce-error" : "td-commerce-note"}>
              {action.confirmationStatus === "failed"
                ? action.confirmationError || (nl ? "Het bevestigingsconcept kon niet worden gemaakt." : "The confirmation draft could not be prepared.")
                : (nl ? "Annulering gelukt. Het bevestigingsconcept wordt voorbereid en wacht op jouw controle." : "Cancellation succeeded. The confirmation draft is being prepared and remains blocked until human review.")}
            </p>
          ) : null}
          {pendingConfirm ? (
            <div className="td-commerce-confirm" role="alertdialog">
              <p>{pendingConfirm.text}</p>
              <div>
                <button type="button" className="td-btn" onClick={() => setPendingConfirm(null)}>{nl ? "Annuleren" : "Cancel"}</button>
                <button type="button" className="td-btn primary" onClick={() => { const next = pendingConfirm; setPendingConfirm(null); void mutate(next.key, next.url, next.init); }}>{nl ? "Ja, uitvoeren" : "Yes, continue"}</button>
              </div>
            </div>
          ) : (
            <div className="td-commerce-actions">
              {canAdminister && action.status === "proposed" ? <button type="button" className="td-btn primary" disabled={Boolean(busy)} onClick={() => mutate("approve", `/api/commerce-actions/${action.id}/approve`, { method: "POST" }, nl ? `Annulering van ${action.orderDisplayName} (${money(action.totalAmount, action.currencyCode)}) kan niet worden teruggedraaid. Het bedrag gaat terug naar de oorspronkelijke betaalmethode en de voorraad wordt teruggezet. Doorgaan?` : `Cancellation of ${action.orderDisplayName} (${money(action.totalAmount, action.currencyCode)}) is irreversible. Refund the original payment method and restock inventory. Continue?`)}>{busy === "approve" ? (nl ? "Uitvoeren…" : "Executing…") : (nl ? "Goedkeuren en uitvoeren" : "Approve and execute")}</button> : null}
              {canAdminister && action.status === "failed" ? <button type="button" className="td-btn" disabled={Boolean(busy)} onClick={() => mutate("retry", `/api/commerce-actions/${action.id}/retry`, { method: "POST" }, nl ? "Annulering opnieuw proberen?" : "Retry cancellation?")}>{nl ? "Opnieuw proberen" : "Retry"}</button> : null}
              {canAdminister && action.status === "succeeded" && action.confirmationStatus === "failed" ? <button type="button" className="td-btn" disabled={Boolean(busy)} onClick={() => mutate("retry-confirmation", `/api/commerce-actions/${action.id}/retry`, { method: "POST" })}>{nl ? "Bevestiging opnieuw maken" : "Retry confirmation"}</button> : null}
              {canAdminister && ["proposed", "failed", "blocked"].includes(action.status) ? <button type="button" className="td-btn ghost" disabled={Boolean(busy)} onClick={() => mutate("reject", `/api/commerce-actions/${action.id}/reject`, { method: "POST" })}>{nl ? "Afwijzen en zelf oplossen" : "Reject and resolve manually"}</button> : null}
            </div>
          )}
          {!canAdminister && ["proposed", "failed", "blocked"].includes(action.status) ? <p className="td-commerce-note">{nl ? "Alleen een beheerder kan deze actie beoordelen." : "Only a tenant admin can review this action."}</p> : null}
        </div>
      ) : null}

      {timeline?.length ? <details className="td-commerce-timeline"><summary>{nl ? "Tijdlijn" : "Timeline"}</summary><div>{timeline.map((item) => <p key={item.id}><span>{item.label}</span><span>{new Date(item.occurredAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></p>)}</div></details> : null}
      {error ? <p role="alert" className="td-commerce-error">{error}</p> : null}
    </div>
  );
}
