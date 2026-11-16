import { createSign } from "node:crypto";

import { GTM_ID } from "@/lib/marketing/tags";

/**
 * Google Analytics 4 en Meta (pixel + advertenties) voor het beheerdashboard.
 * Beide zijn optioneel: zonder de omgevingsvariabelen hieronder toont het
 * dashboard wat er nog ontbreekt, en werkt de rest gewoon.
 *
 * Meten op de website (de tags zelf, na toestemming van de bezoeker):
 *   Google Tag Manager              lib/marketing/tags.ts (GTM-…); GA4 loopt via de container
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID   G-XXXXXXXXXX, alleen nodig zonder Tag Manager
 *   NEXT_PUBLIC_META_PIXEL_ID       het pixel-id (cijfers)
 * Cijfers tonen in het dashboard:
 *   GA4_PROPERTY_ID                 het property-id (cijfers, niet de G-code)
 *   GA4_SERVICE_ACCOUNT_JSON        sleutel van een serviceaccount met rol Kijker op de property (JSON of base64)
 *   META_ADS_ACCESS_TOKEN           systeemgebruikerstoken met ads_read
 *   META_AD_ACCOUNT_ID              advertentieaccount (met of zonder act_)
 */

const GRAPH = "https://graph.facebook.com/v23.0";
const TIMEOUT_MS = 8000;

export type Requirement = { env: string; label: string; set: boolean };

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = body?.error as { message?: string } | string | undefined;
    throw new Error(typeof error === "string" ? error : error?.message ?? `HTTP ${response.status}`);
  }
  return body ?? {};
}

/* ---------- Google Analytics 4 ---------- */

export type Ga4Report = {
  users: number; sessions: number; pageViews: number; engagementPct: number; keyEvents: number;
  channels: Array<{ name: string; sessions: number; users: number; keyEvents: number }>;
  pages: Array<{ path: string; views: number; users: number }>;
  daily: Array<{ day: string; sessions: number }>;
};

export function ga4Requirements(env: Record<string, string | undefined> = process.env): Requirement[] {
  return [
    { env: GTM_ID || "NEXT_PUBLIC_GTM_ID", label: "Tag Manager-container op de website; de GA4-tag zelf zet je in de container", set: Boolean(GTM_ID) || Boolean(env.NEXT_PUBLIC_GA_MEASUREMENT_ID) },
    { env: "GA4_PROPERTY_ID", label: "Property-id (cijfers): welke property het dashboard uitleest", set: Boolean(env.GA4_PROPERTY_ID) },
    { env: "GA4_SERVICE_ACCOUNT_JSON", label: "Sleutel van een serviceaccount met leesrechten op die property", set: Boolean(env.GA4_SERVICE_ACCOUNT_JSON) },
  ];
}

function serviceAccount(raw: string) {
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(text) as { client_email?: string; private_key?: string; token_uri?: string };
  if (!parsed.client_email || !parsed.private_key) throw new Error("GA4_SERVICE_ACCOUNT_JSON mist client_email of private_key");
  return { email: parsed.client_email, key: parsed.private_key.replace(/\\n/g, "\n"), tokenUri: parsed.token_uri ?? "https://oauth2.googleapis.com/token" };
}

async function googleAccessToken(raw: string) {
  const account = serviceAccount(raw);
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: account.email, scope: "https://www.googleapis.com/auth/analytics.readonly", aud: account.tokenUri, iat: now, exp: now + 600 })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.key).toString("base64url");
  const body = await fetchJson(account.tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (typeof body.access_token !== "string") throw new Error("Google gaf geen toegangstoken");
  return body.access_token;
}

type Ga4Row = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };
const metric = (row: Ga4Row | undefined, index: number) => Number(row?.metricValues?.[index]?.value ?? 0);
const dimension = (row: Ga4Row, index = 0) => row.dimensionValues?.[index]?.value ?? "";

export async function loadGa4(days = 28): Promise<{ report: Ga4Report | null; error: string | null }> {
  const propertyId = process.env.GA4_PROPERTY_ID?.replace(/\D/g, "");
  const key = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!propertyId || !key) return { report: null, error: null };
  try {
    const token = await googleAccessToken(key);
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
    const metrics = (names: string[]) => names.map((name) => ({ name }));
    const body = await fetchJson(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          { dateRanges, metrics: metrics(["activeUsers", "sessions", "screenPageViews", "engagementRate", "keyEvents"]) },
          { dateRanges, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: metrics(["sessions", "activeUsers", "keyEvents"]), orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 10 },
          { dateRanges, dimensions: [{ name: "pagePath" }], metrics: metrics(["screenPageViews", "activeUsers"]), orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10 },
          { dateRanges, dimensions: [{ name: "date" }], metrics: metrics(["sessions"]), orderBys: [{ dimension: { dimensionName: "date" } }] },
        ],
      }),
    });
    const reports = (body.reports ?? []) as Array<{ rows?: Ga4Row[] }>;
    const totals = reports[0]?.rows?.[0];
    return {
      error: null,
      report: {
        users: metric(totals, 0), sessions: metric(totals, 1), pageViews: metric(totals, 2), engagementPct: Math.round(metric(totals, 3) * 1000) / 10, keyEvents: metric(totals, 4),
        channels: (reports[1]?.rows ?? []).map((row) => ({ name: dimension(row), sessions: metric(row, 0), users: metric(row, 1), keyEvents: metric(row, 2) })),
        pages: (reports[2]?.rows ?? []).map((row) => ({ path: dimension(row), views: metric(row, 0), users: metric(row, 1) })),
        daily: (reports[3]?.rows ?? []).map((row) => ({ day: dimension(row).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"), sessions: metric(row, 0) })),
      },
    };
  } catch (error) {
    console.error("[backoffice] GA4 ophalen mislukt:", error instanceof Error ? error.message : error);
    return { report: null, error: error instanceof Error ? error.message : "onbekende fout" };
  }
}

/* ---------- Google Analytics 4: de blog ---------- */

export type Ga4BlogRow = { path: string; views: number; users: number; engagedSeconds: number; keyEvents: number; organicEntrances: number };
export type Ga4BlogReport = { views: number; users: number; organicEntrances: number; perPost: Ga4BlogRow[]; daily: Array<{ day: string; views: number }> };

const blogPathFilter = { filter: { fieldName: "pagePath", stringFilter: { matchType: "BEGINS_WITH", value: "/blog" } } };

/** Lezers per blogpost, plus hoeveel bezoekers via Google binnenkwamen op een blogpost. */
export async function loadGa4Blog(days = 28): Promise<{ report: Ga4BlogReport | null; error: string | null }> {
  const propertyId = process.env.GA4_PROPERTY_ID?.replace(/\D/g, "");
  const key = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!propertyId || !key) return { report: null, error: null };
  try {
    const token = await googleAccessToken(key);
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
    const metrics = (names: string[]) => names.map((name) => ({ name }));
    const body = await fetchJson(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          { dateRanges, dimensionFilter: blogPathFilter, metrics: metrics(["screenPageViews", "activeUsers"]) },
          { dateRanges, dimensions: [{ name: "pagePath" }], dimensionFilter: blogPathFilter, metrics: metrics(["screenPageViews", "activeUsers", "userEngagementDuration", "keyEvents"]), orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 250 },
          {
            dateRanges,
            dimensions: [{ name: "landingPage" }],
            dimensionFilter: { andGroup: { expressions: [
              { filter: { fieldName: "landingPage", stringFilter: { matchType: "BEGINS_WITH", value: "/blog" } } },
              { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
            ] } },
            metrics: metrics(["sessions"]),
            limit: 250,
          },
          { dateRanges, dimensions: [{ name: "date" }], dimensionFilter: blogPathFilter, metrics: metrics(["screenPageViews"]), orderBys: [{ dimension: { dimensionName: "date" } }] },
        ],
      }),
    });
    const reports = (body.reports ?? []) as Array<{ rows?: Ga4Row[] }>;
    const clean = (value: string) => value.replace(/[?#].*$/, "").replace(/\/$/, "") || "/";
    const organic = new Map<string, number>();
    for (const row of reports[2]?.rows ?? []) organic.set(clean(dimension(row)), (organic.get(clean(dimension(row))) ?? 0) + metric(row, 0));
    const perPost = new Map<string, Ga4BlogRow>();
    for (const row of reports[1]?.rows ?? []) {
      const path = clean(dimension(row));
      const current = perPost.get(path) ?? { path, views: 0, users: 0, engagedSeconds: 0, keyEvents: 0, organicEntrances: organic.get(path) ?? 0 };
      current.views += metric(row, 0); current.users += metric(row, 1); current.engagedSeconds += metric(row, 2); current.keyEvents += metric(row, 3);
      perPost.set(path, current);
    }
    const totals = reports[0]?.rows?.[0];
    return {
      error: null,
      report: {
        views: metric(totals, 0), users: metric(totals, 1),
        organicEntrances: [...organic.values()].reduce((sum, value) => sum + value, 0),
        perPost: [...perPost.values()],
        daily: (reports[3]?.rows ?? []).map((row) => ({ day: dimension(row).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"), views: metric(row, 0) })),
      },
    };
  } catch (error) {
    console.error("[backoffice] GA4 (blog) ophalen mislukt:", error instanceof Error ? error.message : error);
    return { report: null, error: error instanceof Error ? error.message : "onbekende fout" };
  }
}

/* ---------- Meta: pixel en advertenties ---------- */

export type MetaReport = {
  pixelEvents: Array<{ name: string; count: number }> | null;
  ads: { spendCents: number; impressions: number; clicks: number; ctrPct: number; cpcCents: number; leads: number } | null;
  campaigns: Array<{ name: string; spendCents: number; clicks: number; impressions: number }>;
};

export function metaRequirements(env: Record<string, string | undefined> = process.env): Requirement[] {
  return [
    { env: "NEXT_PUBLIC_META_PIXEL_ID", label: "Pixel-id: zet de pixel op de site", set: Boolean(env.NEXT_PUBLIC_META_PIXEL_ID) },
    { env: "META_ADS_ACCESS_TOKEN", label: "Toegangstoken met leesrechten op advertenties (ads_read)", set: Boolean(env.META_ADS_ACCESS_TOKEN) },
    { env: "META_AD_ACCOUNT_ID", label: "Advertentieaccount: voor uitgaven en kosten per klant", set: Boolean(env.META_AD_ACCOUNT_ID) },
  ];
}

const cents = (value: unknown) => Math.round(Number(value ?? 0) * 100);

export async function loadMeta(days = 30): Promise<{ report: MetaReport | null; error: string | null }> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.replace(/\D/g, "");
  const account = process.env.META_AD_ACCOUNT_ID?.replace(/\D/g, "");
  if (!token || (!pixelId && !account)) return { report: null, error: null };
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const report: MetaReport = { pixelEvents: null, ads: null, campaigns: [] };
  const errors: string[] = [];

  if (pixelId) {
    try {
      const since = Math.floor(Date.now() / 1000) - days * 86_400;
      const body = await fetchJson(`${GRAPH}/${pixelId}/stats?aggregation=event&start_time=${since}`, auth);
      const counts = new Map<string, number>();
      for (const bucket of (body.data ?? []) as Array<{ data?: Array<{ value?: string; count?: number }> }>) {
        for (const item of bucket.data ?? []) if (item.value) counts.set(item.value, (counts.get(item.value) ?? 0) + Number(item.count ?? 0));
      }
      report.pixelEvents = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    } catch (error) {
      errors.push(`pixel: ${error instanceof Error ? error.message : "fout"}`);
    }
  }

  if (account) {
    try {
      const range = days <= 30 ? "last_30d" : "last_90d";
      const [total, campaigns] = await Promise.all([
        fetchJson(`${GRAPH}/act_${account}/insights?date_preset=${range}&fields=spend,impressions,clicks,ctr,cpc,actions`, auth),
        fetchJson(`${GRAPH}/act_${account}/insights?date_preset=${range}&level=campaign&fields=campaign_name,spend,impressions,clicks&limit=25`, auth),
      ]);
      const row = ((total.data ?? []) as Array<Record<string, unknown>>)[0];
      if (row) {
        const actions = (row.actions ?? []) as Array<{ action_type?: string; value?: string }>;
        const leads = actions.filter((action) => /lead|complete_registration/.test(action.action_type ?? "")).reduce((sum, action) => sum + Number(action.value ?? 0), 0);
        report.ads = { spendCents: cents(row.spend), impressions: Number(row.impressions ?? 0), clicks: Number(row.clicks ?? 0), ctrPct: Math.round(Number(row.ctr ?? 0) * 100) / 100, cpcCents: cents(row.cpc), leads };
      } else {
        report.ads = { spendCents: 0, impressions: 0, clicks: 0, ctrPct: 0, cpcCents: 0, leads: 0 };
      }
      report.campaigns = ((campaigns.data ?? []) as Array<Record<string, unknown>>)
        .map((item) => ({ name: String(item.campaign_name ?? "—"), spendCents: cents(item.spend), clicks: Number(item.clicks ?? 0), impressions: Number(item.impressions ?? 0) }))
        .sort((a, b) => b.spendCents - a.spendCents);
    } catch (error) {
      errors.push(`advertenties: ${error instanceof Error ? error.message : "fout"}`);
    }
  }

  if (errors.length) console.error("[backoffice] Meta ophalen mislukt:", errors.join("; "));
  return { report, error: errors.length ? errors.join("; ") : null };
}
