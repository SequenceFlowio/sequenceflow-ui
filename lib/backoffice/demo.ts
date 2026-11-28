import { DAY_MS, type RawData, type RawMarketingEvent } from "./metrics";

/**
 * Verzonnen cijfers om het beheerdashboard lokaal te bekijken zonder database
 * of Stripe (BACKOFFICE_DEMO=1, nooit in productie). Steeds dezelfde uitkomst
 * per dag, zodat schermafbeeldingen vergelijkbaar blijven.
 */

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const SHOPS = ["Noordkust Fietsen", "Studio Lume", "Koffiebranderij Vos", "Petshop Pluis", "Atelier Mare", "Groen & Grond", "Sneakerhuis 010", "De Theeschenkerij", "Bloom Babywear", "Kaaspakhuis", "Loft Wonen", "Zeepmakerij Sop", "Vinyl & Zo", "Hondenhoek", "Tuinkas Direct", "Werkkleding Pro", "Lampenplein", "Sportvoeding NL", "Speelgoedzolder", "Brillenbar", "Natuurzeep", "Kamerplant Co", "Fietstas.nl", "Bakkersgoed", "Wolwinkel Saar"];
const SOURCES: Array<Partial<RawMarketingEvent> & { weight: number; signupRate: number }> = [
  { weight: 30, signupRate: 0.02, referrer: "https://www.google.com/" },
  { weight: 22, signupRate: 0.035, utmSource: "meta", utmMedium: "paid", utmCampaign: "q4-wismo", fbclid: "fb.demo" },
  { weight: 12, signupRate: 0.05, utmSource: "google", utmMedium: "cpc", utmCampaign: "klantenservice-ai", gclid: "gc.demo" },
  { weight: 14, signupRate: 0.012, referrer: null },
  { weight: 8, signupRate: 0.06, utmSource: "linkedin", utmMedium: "social", utmCampaign: "founder-posts" },
  { weight: 6, signupRate: 0.0, utmSource: "tiktok", utmMedium: "paid", utmCampaign: "ugc-test" },
  { weight: 5, signupRate: 0.07, referrer: "https://chatgpt.com/" },
  { weight: 3, signupRate: 0.04, utmSource: "nieuwsbrief", utmMedium: "email", utmCampaign: "november" },
];
const LANDINGS = ["/nl", "/nl", "/nl", "/nl/pricing", "/blog/waar-blijft-mijn-pakket", "/blog/wat-kost-een-klantmail", "/affiliate", "/en"];
const CTAS = ["Start gratis proef", "Start gratis proef", "Bekijk prijzen", "Plan een demo", "Probeer 14 dagen"];
const PLANS = ["starter", "starter", "starter", "pro", "pro", "agency"];
const PRICE: Record<string, number> = { starter: 4700, pro: 14700, agency: 29700, custom: 29700 };

export function demoData(): RawData {
  const today = new Date();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 9);
  const rand = random(20261115);
  const iso = (time: number) => new Date(time).toISOString();
  const pickSource = () => {
    let roll = rand() * SOURCES.reduce((sum, source) => sum + source.weight, 0);
    return SOURCES.find((source) => (roll -= source.weight) < 0) ?? SOURCES[0];
  };

  const data: RawData = {
    now: iso(now), tenants: [], owners: {}, subscriptions: [], invoices: [], refunds: [], events: [], affiliates: [], rewards: [], shopify: [],
    connected: [], drafts30: {}, milestones: {}, internalTenants: [], planPriceCents: PRICE, affiliateMinPayoutCents: 5000, stripeAvailable: true,
    notes: ["Voorbeeldcijfers: dit is de lokale demo, geen echte klantdata."],
  };

  data.affiliates = [
    { id: "aff-1", username: "ecomlisa", name: "Lisa de Boer", email: "lisa@example.com", channel: "Instagram", status: "active", isBusiness: true, createdAt: iso(now - 70 * DAY_MS) },
    { id: "aff-2", username: "webshopwouter", name: "Wouter Jansen", email: "wouter@example.com", channel: "YouTube", status: "active", isBusiness: false, createdAt: iso(now - 52 * DAY_MS) },
    { id: "aff-3", username: "shopstudio-nl", name: "Shop Studio", email: "hallo@example.com", channel: "Nieuwsbrief", status: "active", isBusiness: true, createdAt: iso(now - 20 * DAY_MS) },
    { id: "aff-4", username: "dtc-daan", name: "Daan Visser", email: "daan@example.com", channel: "LinkedIn", status: "active", isBusiness: false, createdAt: iso(now - 9 * DAY_MS) },
  ];
  const refClicks: Record<string, number> = { ecomlisa: 184, webshopwouter: 96, "shopstudio-nl": 31, "k-demo01": 12, "k-demo02": 5 };

  SHOPS.forEach((name, index) => {
    const id = `tenant-${index + 1}`;
    const ageDays = Math.max(1, Math.round(186 - index * 7.7 + rand() * 3));
    const created = now - ageDays * DAY_MS - Math.floor(rand() * DAY_MS);
    const trialEnds = created + 14 * DAY_MS;
    const plan = PLANS[Math.floor(rand() * PLANS.length)];
    const converts = ageDays > 14 ? rand() < 0.42 : rand() < 0.15;
    const churns = converts && ageDays > 60 && rand() < 0.28;
    const customerId = converts ? `cus_demo${index}` : null;
    const affiliate = index % 6 === 2 ? "aff-1" : index % 9 === 4 ? "aff-2" : null;
    const referredBy = !affiliate && index % 8 === 7 ? "tenant-2" : null;
    const source = pickSource();
    const session = `demo-session-${id}`;

    data.tenants.push({
      id, name, plan: converts ? (churns ? "expired" : plan) : ageDays > 14 ? "expired" : "trial",
      created_at: iso(created), trial_ends_at: iso(trialEnds), stripe_customer_id: customerId, stripe_subscription_id: converts && !churns ? `sub_demo${index}` : null,
      referred_by_tenant_id: referredBy, affiliate_id: affiliate, referral_code: index < 2 ? `k-demo0${index + 1}` : null,
    });
    data.owners[id] = { email: `eigenaar@${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.nl`, lastSignInAt: iso(now - Math.floor(rand() * (converts && !churns ? 4 : 30)) * DAY_MS) };
    if (converts || rand() < 0.55) {
      data.connected.push(id);
      const drafted = converts || rand() < 0.8;
      const sent = drafted && (converts || rand() < 0.5);
      data.milestones![id] = { connectedAt: iso(created + 3600_000), firstDraftAt: drafted ? iso(created + 5 * 3600_000) : null, firstSentAt: sent ? iso(created + DAY_MS) : null };
    }
    if (converts && !churns && rand() < 0.88) data.drafts30[id] = 40 + Math.floor(rand() * 900);
    else if (!converts && ageDays <= 14 && rand() < 0.6) data.drafts30[id] = 3 + Math.floor(rand() * 60);

    data.events.push(
      { event: "landing_view", sessionId: session, tenantId: null, path: LANDINGS[index % LANDINGS.length], referrer: source.referrer ?? null, utmSource: source.utmSource ?? null, utmMedium: source.utmMedium ?? null, utmCampaign: source.utmCampaign ?? null, gclid: source.gclid ?? null, fbclid: source.fbclid ?? null, label: null, createdAt: iso(created - 3600_000) },
      { event: "signup_completed", sessionId: session, tenantId: id, path: "/auth/callback", referrer: source.referrer ?? null, utmSource: source.utmSource ?? null, utmMedium: source.utmMedium ?? null, utmCampaign: source.utmCampaign ?? null, gclid: source.gclid ?? null, fbclid: source.fbclid ?? null, label: null, createdAt: iso(created) },
    );

    if (converts && customerId) {
      const started = created + Math.round((4 + rand() * 12) * DAY_MS);
      const ended = churns ? started + Math.round((1 + Math.floor(rand() * 3)) * 30.4 * DAY_MS) : null;
      const leaving = !churns && index % 11 === 3;
      data.subscriptions.push({
        id: `sub_demo${index}`, customerId, status: churns ? "canceled" : "active", startedAt: iso(started), canceledAt: ended ? iso(Math.min(ended, now - DAY_MS)) : null,
        cancelAt: leaving ? iso(now + 12 * DAY_MS) : null, monthlyCents: PRICE[plan], reason: churns ? ["te duur", "niet gebruikt", "door de klant opgezegd"][index % 3] : leaving ? "mist functies" : null,
      });
      for (let month = 0; started + month * 30.4 * DAY_MS < Math.min(ended ?? now, now); month++) {
        const paidAt = started + month * 30.4 * DAY_MS;
        const usage = month ? Math.floor(rand() * 60) * 47 : 0;
        const invoiceId = `in_demo${index}_${month}`;
        data.invoices.push({ id: invoiceId, customerId, status: "paid", netCents: PRICE[plan] + usage, createdAt: iso(paidAt), paidAt: iso(paidAt), reason: month ? "subscription_cycle" : "subscription_create", attempts: 1 });
        if (affiliate) {
          const due = paidAt + 60 * DAY_MS;
          data.rewards.push({ id: `rw_${invoiceId}`, kind: "affiliate_commission", affiliateId: affiliate, referrerTenantId: null, referredTenantId: id, amountCents: Math.round((PRICE[plan] + usage) * 0.05), baseCents: PRICE[plan] + usage, rate: 0.05, status: due < now ? (month === 0 && affiliate === "aff-1" ? "paid" : "available") : "pending", invoicePaidAt: iso(paidAt), availableAt: iso(due) });
        }
        if (referredBy && month === 0) data.rewards.push({ id: `rc_${invoiceId}`, kind: "referrer_credit", affiliateId: null, referrerTenantId: referredBy, referredTenantId: id, amountCents: 940, baseCents: PRICE[plan], rate: 0.2, status: paidAt + 30 * DAY_MS < now ? "paid" : "pending", invoicePaidAt: iso(paidAt), availableAt: iso(paidAt + 30 * DAY_MS) });
      }
    }
  });

  // Grote affiliate krijgt extra uitbetaalbare commissie, zodat de uitbetaallijst iets toont.
  data.rewards.push({ id: "rw_extra", kind: "affiliate_commission", affiliateId: "aff-1", referrerTenantId: null, referredTenantId: "tenant-3", amountCents: 6200, baseCents: 124000, rate: 0.05, status: "available", invoicePaidAt: iso(now - 75 * DAY_MS), availableAt: iso(now - 15 * DAY_MS) });
  data.invoices.push({ id: "in_demo_open", customerId: "cus_demo0", status: "open", netCents: 14700, createdAt: iso(now - 2 * DAY_MS), paidAt: null, reason: "subscription_cycle", attempts: 2 });
  data.refunds.push({ amountCents: 4700, createdAt: iso(now - 40 * DAY_MS) });
  data.shopify.push({ tenantId: "tenant-5", shop: "atelier-mare.myshopify.com", status: "uninstalled", installedAt: iso(now - 150 * DAY_MS), uninstalledAt: iso(now - 95 * DAY_MS) });

  // Bezoek van de laatste 30 dagen zonder aanmelding.
  for (let day = 0; day < 30; day++) {
    const visits = 38 + Math.floor(rand() * 34) + (day % 7 < 2 ? -14 : 0) + Math.round((30 - day) * 0.5);
    for (let visit = 0; visit < visits; visit++) {
      const source = pickSource();
      const sessionId = `demo-visit-${day}-${visit}`;
      const at = now - day * DAY_MS - Math.floor(rand() * DAY_MS * 0.9);
      const base = { sessionId, tenantId: null, referrer: source.referrer ?? null, utmSource: source.utmSource ?? null, utmMedium: source.utmMedium ?? null, utmCampaign: source.utmCampaign ?? null, gclid: source.gclid ?? null, fbclid: source.fbclid ?? null };
      data.events.push({ ...base, event: "landing_view", path: LANDINGS[Math.floor(rand() * LANDINGS.length)], label: null, createdAt: iso(at) });
      if (rand() < 0.11 + source.signupRate) data.events.push({ ...base, event: "cta_click", path: "/nl", label: CTAS[Math.floor(rand() * CTAS.length)], createdAt: iso(at + 60_000) });
    }
  }
  for (const [code, count] of Object.entries(refClicks)) {
    for (let click = 0; click < count; click++) data.events.push({ event: "landing_view", sessionId: `demo-ref-${code}-${click}`, tenantId: null, path: `/r/${code}`, referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, gclid: null, fbclid: null, label: null, createdAt: iso(now - Math.floor(rand() * 60) * DAY_MS) });
  }

  return data;
}
