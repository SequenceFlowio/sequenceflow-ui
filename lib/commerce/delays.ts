/**
 * Vertraagde zendingen herkennen voordat de klant mailt. Drie signalen:
 * - de beloofde leverdatum is voorbij en het pakket is niet bezorgd;
 * - verzonden, maar al 3 dagen geen nieuwe trackingupdate;
 * - besteld, maar na 2 dagen nog niet verzonden.
 * Geannuleerde en bezorgde bestellingen tellen niet.
 */

export type DelayOrder = {
  id: string;
  displayName: string | null;
  provider: string;
  orderCreatedAt: string | null;
  cancelledAt: string | null;
  promisedBy: string | null; // vroegste "uiterlijk geleverd" van de regels
  shippedAt: string | null;
  lastTrackingAt: string | null;
  transportCode: string | null;
  trackingUrl: string | null;
};

export type DelayReason = "past_promise" | "tracking_stalled" | "not_shipped";
export type Delay = { order: DelayOrder; reason: DelayReason; days: number };

const DAY = 24 * 60 * 60 * 1000;

export function isDelivered(code: string | null | undefined) {
  const value = (code ?? "").toUpperCase();
  return value.includes("DELIVERED") || value.includes("PICKED_UP") || value.includes("RETURN");
}

export function findDelays(orders: DelayOrder[], now: Date = new Date()): Delay[] {
  const t = now.getTime();
  const out: Delay[] = [];
  for (const order of orders) {
    if (order.cancelledAt || isDelivered(order.transportCode)) continue;
    const promised = order.promisedBy ? Date.parse(order.promisedBy) : NaN;
    if (Number.isFinite(promised) && promised < t) {
      out.push({ order, reason: "past_promise", days: Math.max(1, Math.floor((t - promised) / DAY)) });
      continue;
    }
    if (order.shippedAt) {
      // Alleen bij echte trackingdata: zonder updates (veel Shopify-winkels) weten we niets.
      const last = order.lastTrackingAt ? Date.parse(order.lastTrackingAt) : NaN;
      if (Number.isFinite(last) && t - last > 3 * DAY) out.push({ order, reason: "tracking_stalled", days: Math.floor((t - last) / DAY) });
      continue;
    }
    const created = order.orderCreatedAt ? Date.parse(order.orderCreatedAt) : NaN;
    if (Number.isFinite(created) && t - created > 2 * DAY) out.push({ order, reason: "not_shipped", days: Math.floor((t - created) / DAY) });
  }
  const weight: Record<DelayReason, number> = { past_promise: 0, tracking_stalled: 1, not_shipped: 2 };
  return out.sort((a, b) => weight[a.reason] - weight[b.reason] || b.days - a.days);
}

/** Een bericht dat de winkel naar de klant kan sturen (via de eigen mailbox of het bol-berichtensysteem). */
export function delayMessage(delay: Delay, nl = true) {
  const order = delay.order.displayName ? ` ${delay.order.displayName}` : "";
  const track = delay.order.trackingUrl ? (nl ? ` Je kunt je pakket volgen via ${delay.order.trackingUrl}.` : ` You can track it here: ${delay.order.trackingUrl}.`) : "";
  if (!nl) {
    return delay.reason === "not_shipped"
      ? `Hi, a quick update on your order${order}: it is taking a little longer to ship than usual. We'll send it as soon as possible and let you know when it's on its way. Sorry for the wait.`
      : `Hi, a quick update on your order${order}: it is taking longer than expected to reach you.${track} We're keeping an eye on it and will get in touch if anything changes. Sorry for the wait.`;
  }
  return delay.reason === "not_shipped"
    ? `Hoi, even een update over je bestelling${order}: het verzenden duurt iets langer dan normaal. We sturen hem zo snel mogelijk op en laten het je weten zodra hij onderweg is. Sorry voor het wachten.`
    : `Hoi, even een update over je bestelling${order}: die doet er langer over dan verwacht.${track} We houden het in de gaten en laten van ons horen als er iets verandert. Sorry voor het wachten.`;
}
