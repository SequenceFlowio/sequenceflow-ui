import type { Metadata } from "next";

import { adminState, backofficeDemo } from "@/lib/backoffice/auth";
import { adminEmails } from "@/lib/backoffice/authCore";
import { loadCosts } from "@/lib/backoffice/costsData";
import { loadDashboard, loadPayoutAdmin } from "@/lib/backoffice/data";
import { ga4Requirements, loadGa4, loadGa4Blog, loadMeta, metaRequirements } from "@/lib/backoffice/integrations";
import { getBlogPostPreview, listAllBlogPosts } from "@/lib/marketing/blog";
import { isLive, POSTS_PER_WEEK_TARGET, weeklyCadence } from "@/lib/marketing/blogSchedule";

import { LoginFlow, LogoutButton } from "./LoginFlow";
import { OpenAiCredit } from "./OpenAiCredit";
import { ResendUsage } from "./ResendUsage";
import { loadResendUsage, type ResendUsageState } from "@/lib/backoffice/resendUsage";
import { loadCredit, type CreditState } from "@/lib/backoffice/openaiCredit";
import { mailPreviews } from "@/lib/email/previews";

import { InternalMarker } from "@/components/marketing/InternalMarker";
import { listLeads, type LeadRow } from "@/lib/sales/store";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { FollowupBoard, type FollowupView, type TrialView } from "./FollowupBoard";
import { LeadsBoard, type LeadView } from "./LeadsBoard";
import { listFollowups, syncTrialFollowups, type TrialRow } from "@/lib/sales/trials";

import { AcademyTab, BlogPreview, BlogTab, CostsTab, CustomersTab, FunnelTab, MailsTab, MarketingTab, OverviewTab, PartnersTab, RevenueTab, SettingsTab } from "./sections";
import "./backoffice.css";

export const metadata: Metadata = {
  title: "Beheer · SequenceFlow",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};
export const dynamic = "force-dynamic";

/**
 * Beheerdashboard van SequenceFlow zelf, op sequenceflow.io/backoffice.
 * Aanmeldingen, proeven, omzet, partners en
 * marketing in één scherm. Alleen na inloggen met e-mailcode en authenticator;
 * voor ieder ander is dit een inlogscherm zonder inhoud.
 */

const TABS = [
  { key: "overzicht", label: "Overzicht" },
  { key: "klanten", label: "Aan- en afmeldingen" },
  { key: "omzet", label: "Omzet" },
  { key: "kosten", label: "Kosten en winst" },
  { key: "partners", label: "Doorverwijzingen en affiliates" },
  { key: "funnel", label: "Funnel" },
  { key: "leads", label: "Leads" },
  { key: "opvolging", label: "Opvolging" },
  { key: "marketing", label: "Marketing" },
  { key: "blog", label: "Blog" },
  { key: "mails", label: "Mails" },
  { key: "academy", label: "Academy" },
  { key: "koppelingen", label: "Koppelingen" },
] as const;

export default async function BackofficePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = await adminState();
  if (state.state !== "ok") {
    return <LoginFlow initial={state.state === "needs_mfa" ? "mfa" : "email"} knownEmail={state.state === "needs_mfa" ? state.email : undefined} />;
  }

  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const tab = TABS.find((item) => item.key === one(params.tab))?.key ?? "overzicht";
  const needsAds = tab === "marketing";

  const [data, ga4, meta, payouts, blogGa4] = await Promise.all([
    loadDashboard({ fresh: one(params.vers) === "1" }),
    needsAds ? loadGa4() : Promise.resolve({ report: null, error: null }),
    needsAds ? loadMeta() : Promise.resolve({ report: null, error: null }),
    tab === "partners" ? loadPayoutAdmin() : Promise.resolve({ ready: false, queue: [], history: [] }),
    tab === "blog" ? loadGa4Blog() : Promise.resolve({ report: null, error: null }),
  ]);
  const costs = tab === "kosten" ? await loadCosts(data, { fresh: one(params.vers) === "1" }) : null;
  const updated = new Date(data.now).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });

  return (
    <div className="bo">
      <InternalMarker />
      <header className="bo-top">
        <div>
          <p className="bo-eyebrow">Alleen voor SequenceFlow</p>
          <h1>Beheer</h1>
        </div>
        <div className="bo-top-meta">
          <span>Bijgewerkt {updated}</span>
          <a className="bo-link" href={`?tab=${tab}&vers=1`}>Verversen</a>
          <LogoutButton />
        </div>
      </header>

      <nav className="bo-tabs" aria-label="Onderdelen">
        {TABS.map((item) => <a key={item.key} href={`?tab=${item.key}`} className={item.key === tab ? "is-active" : undefined} aria-current={item.key === tab ? "page" : undefined}>{item.label}</a>)}
      </nav>

      {data.notes.map((note) => <p key={note} className="bo-banner">{note}</p>)}

      <main className="bo-main">
        {tab === "overzicht" ? (
          <div className="bo-grid bo-grid--top">
            <OpenAiCredit {...await creditForOverview()} />
            <ResendUsage state={await resendForOverview(one(params.vers) === "1")} />
          </div>
        ) : null}
        {tab === "overzicht" ? <OverviewTab data={data} /> : null}
        {tab === "klanten" ? <CustomersTab data={data} filter={one(params.status)} /> : null}
        {tab === "omzet" ? <RevenueTab data={data} /> : null}
        {tab === "kosten" && costs ? <CostsTab report={costs.report} error={costs.error} meta={metaRequirements()} /> : null}
        {tab === "partners" ? <PartnersTab data={data} payouts={payouts} /> : null}
        {tab === "funnel" ? <FunnelTab data={data} /> : null}
        {tab === "leads" ? await leadsTab() : null}
        {tab === "opvolging" ? await followupTab() : null}
        {tab === "marketing" ? <MarketingTab data={data} ga4={{ ...ga4, requirements: ga4Requirements() }} meta={{ ...meta, requirements: metaRequirements() }} /> : null}
        {tab === "blog" ? (() => {
          const now = Date.now();
          const preview = one(params.post) ? getBlogPostPreview(one(params.post)) : null;
          if (preview) return <BlogPreview post={{ ...preview, live: isLive(preview.publishDate, now) }} />;
          const posts = listAllBlogPosts().map((post) => ({ slug: post.slug, title: post.title, tag: post.tag, keyword: post.keyword, publishDate: post.publishDate, publishAt: post.publishAt, live: isLive(post.publishDate, now) }));
          return <BlogTab now={now} posts={posts} target={POSTS_PER_WEEK_TARGET} cadence={weeklyCadence(posts.map((post) => post.publishDate), now, 8)} ga4={{ ...blogGa4, requirements: ga4Requirements() }} />;
        })() : null}
        {tab === "academy" ? <AcademyTab /> : null}
        {tab === "mails" ? <MailsTab previews={mailPreviews()} active={one(params.mail)} language={one(params.taal) === "en" ? "en" : "nl"} /> : null}
        {tab === "koppelingen" ? <SettingsTab ga4={ga4Requirements()} meta={metaRequirements()} adminCount={adminEmails(process.env.PLATFORM_ADMIN_EMAILS).length} email={state.email} stripe={data.stripeAvailable} /> : null}
      </main>
    </div>
  );
}

/** OpenAI-tegoed voor het overzicht; een fout hier mag het dashboard niet breken. */
async function creditForOverview(): Promise<{ ready: boolean; estimate: import("@/lib/backoffice/openaiCreditCore").CreditEstimate | null; adminKey: boolean; error?: string }> {
  if (backofficeDemo()) {
    const { estimateCredit } = await import("@/lib/backoffice/openaiCreditCore");
    return { ready: true, adminKey: false, estimate: estimateCredit({ balanceUsd: 50, notedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(), spentSinceUsd: 34.2, last7DaysUsd: 39.9, basis: "estimate" }) };
  }
  const state: CreditState = await loadCredit().catch((error) => ({ ready: true, estimate: null, adminKey: false, error: error instanceof Error ? error.message : String(error) }));
  return state.ready ? state : { ready: false, estimate: null, adminKey: false };
}

/** Resend-verbruik voor het overzicht; in de demo voorbeeldcijfers. */
async function resendForOverview(fresh: boolean): Promise<ResendUsageState> {
  if (backofficeDemo()) {
    const day = new Date().getUTCDate();
    return { ok: true, fetchedAt: new Date().toISOString(), usage: {
      daily: { used: 64, limit: 100, sent: 41, received: 23, resetsAt: new Date(Date.now() + 5 * 3_600_000).toISOString() },
      monthly: { used: 95 * day, limit: 3000, sent: 60 * day, received: 35 * day, resetsAt: null },
      domains: { used: 2, limit: 1 }, rateLimit: { limit: 5, duration: "1000ms" },
    } };
  }
  return loadResendUsage({ fresh }).catch((error) => ({ ok: false as const, reason: "error" as const, message: error instanceof Error ? error.message : String(error) }));
}

/** Leads uit Supabase (migratie 081); in de demo twee verzonnen winkels. */
async function leadsTab() {
  const mailDomainReady = Boolean(process.env.SALES_MAIL_DOMAIN?.trim());
  let rows: LeadRow[] = [];
  let error: string | null = null;
  if (backofficeDemo()) rows = demoLeads();
  else {
    try {
      rows = await listLeads(getSupabaseAdmin());
    } catch (loadError) {
      error = loadError instanceof Error ? loadError.message : String(loadError);
    }
  }
  const leads: LeadView[] = rows.map((row) => ({
    id: row.id, domain: row.domain, name: row.name, website: row.website, bolUrl: row.bol_url, platform: row.platform, category: row.category,
    contactEmail: row.contact_email, linkedinUrl: row.linkedin_url, score: row.score, scoreReasons: row.score_reasons ?? [], status: row.status,
    linkedinDraft: row.linkedin_draft, emailSubject: row.email_subject, emailDraft: row.email_draft,
    nextAction: row.next_action, nextActionAt: row.next_action_at, contactedAt: row.contacted_at, notes: row.notes, createdAt: row.created_at,
    helpdesk: row.signals?.helpdesk ?? [], productCount: row.signals?.productCount ?? null,
  }));
  return (
    <>
      {error ? <p className="bo-banner">Leads konden niet worden geladen: {error}</p> : null}
      <LeadsBoard leads={leads} mailDomainReady={mailDomainReady} />
    </>
  );
}

function demoLeads(): LeadRow[] {
  const now = new Date().toISOString();
  const base = { bol_url: null, category: null, contact_email: null, linkedin_url: null, signals: {}, linkedin_draft: null, email_subject: null, email_draft: null, drafted_at: null, next_action: null, next_action_at: null, contacted_at: null, notes: null, source: "demo", tenant_id: null, enriched_at: now, created_at: now, updated_at: now };
  return [
    { ...base, id: "00000000-0000-4000-8000-000000000001", domain: "voorbeeldwinkel.nl", name: "Voorbeeldwinkel", website: "https://voorbeeldwinkel.nl", bol_url: "https://www.bol.com/nl/nl/v/voorbeeldwinkel/0/", platform: "shopify", score: 85, score_reasons: ["+30 verkoopt op bol (link naar bol-winkel)", "+10 Nederlandse shop", "+15 draait op shopify (koppeling bestaat)", "+15 640 producten", "+10 geen helpdesk-tool gezien", "+5 algemeen contactadres gevonden"], status: "goedgekeurd", contact_email: "klantenservice@voorbeeldwinkel.nl", signals: { productCount: 640, helpdesk: [] }, linkedin_draft: "Zag dat Voorbeeldwinkel naast de eigen Shopify-shop ook op bol verkoopt. Komen daar veel dezelfde vragen over bezorging en retour binnen? Ik bouw Support One, dat concepten klaarzet in je eigen mailbox. Mag ik laten zien hoe dat met jullie mail werkt?", email_subject: "klantvragen via bol en shopify", email_draft: "Hoi team van Voorbeeldwinkel,\n\n…", next_action: "Opvolgen (linkedin)", next_action_at: now },
    { ...base, id: "00000000-0000-4000-8000-000000000002", domain: "testshop.nl", name: "Testshop", website: "https://testshop.nl", platform: "woocommerce", score: 40, score_reasons: ["+10 Nederlandse shop", "+15 draait op woocommerce (koppeling bestaat)", "+10 geen helpdesk-tool gezien", "+5 algemeen contactadres gevonden"], status: "nieuw", signals: { productCount: 45, helpdesk: [] } },
  ];
}

/** Proefaccounts opvolgen: concepten voor vandaag klaarzetten (niets versturen) en tonen. */
async function followupTab() {
  const demoLink = Boolean(process.env.DEMO_BOOKING_URL?.trim());
  if (backofficeDemo()) return <FollowupBoard demoLink={demoLink} {...demoFollowups()} />;
  try {
    const db = getSupabaseAdmin();
    const { trials } = await syncTrialFollowups(db);
    const [followups, leads] = await Promise.all([
      listFollowups(db),
      db.from("sales_leads").select("tenant_id, next_action, next_action_at").not("tenant_id", "is", null).then(({ data }) => new Map((data ?? []).map((row) => [row.tenant_id as string, row]))),
    ]);
    const names = new Map(trials.map((trial) => [trial.tenantId, trial.name]));
    return (
      <FollowupBoard
        demoLink={demoLink}
        followups={followups.filter((row) => row.status !== "overgeslagen").map((row): FollowupView => ({ id: row.id, tenantName: names.get(row.tenant_id) ?? "Werkruimte", email: row.to_email, step: row.step, variant: row.variant, dueAt: row.due_at, status: row.status, subject: row.subject, body: row.body, sentAt: row.sent_at, sentBy: row.sent_by }))}
        trials={trials.filter((trial) => !trial.internal).map((trial) => trialView(trial, leads.get(trial.tenantId) ?? null))}
      />
    );
  } catch (error) {
    return <p className="bo-banner">Opvolging kon niet worden geladen: {error instanceof Error ? error.message : String(error)}</p>;
  }
}

function trialView(trial: TrialRow, lead: { next_action: string | null; next_action_at: string | null } | null): TrialView {
  return {
    tenantId: trial.tenantId, name: trial.name, email: trial.email, createdAt: trial.createdAt, trialEndsAt: trial.trialEndsAt, plan: trial.plan,
    connected: Boolean(trial.connectedAt), drafted: Boolean(trial.firstDraftAt), sent: Boolean(trial.firstSentAt), paying: trial.paying,
    day: Math.max(0, Math.floor((Date.now() - Date.parse(trial.createdAt)) / 86_400_000)),
    nextAction: lead?.next_action ?? null, nextActionAt: lead?.next_action_at ?? null,
  };
}

function demoFollowups(): { followups: FollowupView[]; trials: TrialView[] } {
  const now = Date.now();
  const iso = (days: number) => new Date(now - days * 86_400_000).toISOString();
  return {
    followups: [
      { id: "00000000-0000-4000-8000-0000000000a1", tenantName: "Voorbeeldwinkel", email: "eigenaar@voorbeeldwinkel.nl", step: 2, variant: "geen-mailbox", dueAt: iso(0), status: "concept", subject: "Lukt het koppelen van je mailbox?", body: "Hoi,\n\nJe hebt twee dagen geleden Support One aangemaakt, maar je mailbox is nog niet gekoppeld…\n\nGroet,\nNavaron\nSequenceFlow", sentAt: null, sentBy: null },
    ],
    trials: [
      { tenantId: "t1", name: "Voorbeeldwinkel", email: "eigenaar@voorbeeldwinkel.nl", createdAt: iso(2), trialEndsAt: iso(-12), plan: "trial", connected: false, drafted: false, sent: false, paying: false, day: 2, nextAction: "Bellen: hoe gaat de proef?", nextActionAt: iso(0) },
      { tenantId: "t2", name: "Testshop", email: "info@testshop.nl", createdAt: iso(9), trialEndsAt: iso(-5), plan: "trial", connected: true, drafted: true, sent: true, paying: false, day: 9, nextAction: null, nextActionAt: null },
    ],
  };
}

