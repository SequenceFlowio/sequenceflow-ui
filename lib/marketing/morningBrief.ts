import { loadDashboard } from "@/lib/backoffice/data";
import { loadMeta } from "@/lib/backoffice/integrations";
import { sourceOf } from "@/lib/backoffice/metrics";
import { noticeRecipients } from "@/lib/backoffice/notifyCore";
import { listPosts } from "@/lib/contentCalendar/db";
import { renderBrandedEmail, type MailBlock } from "@/lib/email/branded";
import { sendEmail } from "@/lib/resend";
import { syncTrialFollowups } from "@/lib/sales/trials";
import { SITE_ORIGIN } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { buildMorningBrief, type BriefInput, type BriefPost } from "./morningBriefCore";

const DAY_MS = 86_400_000;
const OPEN_STATUSES = ["nieuw", "goedgekeurd", "benaderd", "gereageerd", "demo", "trial"];

const amsterdamDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });

/** Alle gegevens voor de brief. Elke bron die faalt, laat zijn eigen blok leeg in plaats van de brief te breken. */
export async function collectBriefInput(now = new Date()): Promise<BriefInput> {
  const db = getSupabaseAdmin();
  const nowIso = now.toISOString();
  const since7 = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const yesterday = amsterdamDay(new Date(now.getTime() - DAY_MS).toISOString());
  const endOfToday = new Date(`${amsterdamDay(nowIso)}T23:59:59+01:00`).toISOString();

  // Eerst de opvolgconcepten van vandaag klaarzetten (verstuurt niets).
  await syncTrialFollowups(db, now).catch((error) => console.error("[brief] opvolging klaarzetten mislukt", error));

  const [dashboard, meta, events, posts, leadsDue, newLeads, followups] = await Promise.all([
    loadDashboard({ fresh: true }),
    process.env.META_ADS_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID ? loadMeta(7) : Promise.resolve({ report: null, error: null }),
    db.from("marketing_events").select("event_name, session_id, path, referrer, utm_source, utm_campaign, gclid, fbclid, client, created_at")
      .eq("internal", false).gte("created_at", since7).limit(20000).then(({ data }) => (data ?? []).filter((row) => row.client !== "bot" && row.client !== "headless")),
    listPosts().catch(() => []),
    db.from("sales_leads").select("name, domain, next_action, next_action_at").in("status", OPEN_STATUSES).lte("next_action_at", endOfToday).order("next_action_at").limit(30).then(({ data }) => data ?? []),
    db.from("sales_leads").select("id", { count: "exact", head: true }).eq("status", "nieuw").then(({ count }) => count ?? 0),
    db.from("trial_followups").select("tenant_id, step, subject").eq("status", "concept").order("due_at").limit(30).then(({ data }) => data ?? []),
  ]);

  // Funnel: deze en vorige kalenderweek uit de Funnel-tab.
  const weeks = dashboard.funnel.weeks;
  const pick = (row?: (typeof weeks)[number]) => ({ visits: row?.visits ?? 0, signups: row?.signups ?? 0, mailbox: row?.mailbox ?? 0, draft: row?.draft ?? 0, sent: row?.sent ?? 0, paid: row?.paid ?? 0 });

  // Bezoeken per sessie met de bron van de eerste paginaweergave.
  const firstView = new Map<string, (typeof events)[number]>();
  for (const row of events) if (row.event_name === "landing_view" && !String(row.path).startsWith("/r/") && (!firstView.has(row.session_id) || row.created_at < firstView.get(row.session_id)!.created_at)) firstView.set(row.session_id, row);
  const src = (row: (typeof events)[number]) => sourceOf({ utmSource: row.utm_source, gclid: row.gclid, fbclid: row.fbclid, referrer: row.referrer, client: row.client });
  const signups = events.filter((row) => row.event_name === "signup_completed");
  const ySources = new Map<string, { visits: number; signups: number }>();
  for (const row of firstView.values()) if (amsterdamDay(row.created_at) === yesterday) { const s = ySources.get(src(row)) ?? { visits: 0, signups: 0 }; s.visits++; ySources.set(src(row), s); }
  for (const row of signups) if (amsterdamDay(row.created_at) === yesterday) { const s = ySources.get(src(row)) ?? { visits: 0, signups: 0 }; s.signups++; ySources.set(src(row), s); }
  const social = (key: string) => [...firstView.values()].filter((row) => src(row) === key || (key === "instagram" && src(row) === "meta (organisch)")).length;

  // Aanmeldingen per campagne (utm_campaign = campagnenaam in Meta) in 7 dagen.
  const byCampaign = new Map<string, number>();
  for (const row of signups) if (row.utm_campaign) byCampaign.set(row.utm_campaign.trim().toLowerCase(), (byCampaign.get(row.utm_campaign.trim().toLowerCase()) ?? 0) + 1);

  const briefPosts: BriefPost[] = [];
  for (const post of posts) {
    const m = post.metrics?.latest;
    const base = { title: post.headline || post.id, likes: m?.likes ?? 0, comments: m?.comments ?? 0, saves: m?.saves ?? 0, shares: m?.shares ?? 0, follows: m?.follows ?? 0, profileVisits: m?.profileVisits ?? 0 };
    if (post.publish?.instagram) briefPosts.push({ ...base, platform: "instagram", publishedAt: post.publish.instagram.at, reach: m?.reach ?? null });
    else if (post.publish?.error && post.date && Date.parse(`${post.date}T12:00:00Z`) > now.getTime() - 7 * DAY_MS && Date.parse(`${post.date}T12:00:00Z`) < now.getTime()) briefPosts.push({ ...base, platform: "instagram", publishedAt: `${post.date}T12:00:00Z`, reach: null, status: "failed" });
    if (post.publish?.tiktok) briefPosts.push({ ...base, platform: "tiktok", publishedAt: post.publish.tiktok.at, reach: null, likes: 0, comments: 0, saves: 0, shares: 0, follows: 0, profileVisits: 0, status: post.publish.tiktok.status });
  }

  const names = new Map(dashboard.customers.map((c) => [c.id, c.name]));
  const report = meta.report;
  return {
    now: nowIso,
    thisWeek: pick(weeks.at(-1)),
    lastWeek: pick(weeks.at(-2)),
    bottleneck: dashboard.funnel.bottleneck,
    yesterday: {
      visits: [...ySources.values()].reduce((s, v) => s + v.visits, 0),
      signups: [...ySources.values()].reduce((s, v) => s + v.signups, 0),
      bySource: [...ySources.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.signups - a.signups || b.visits - a.visits),
    },
    ads: {
      linked: Boolean(process.env.META_ADS_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID),
      error: meta.error,
      totals: report?.ads ? { spendCents: report.ads.spendCents, impressions: report.ads.impressions, clicks: report.ads.clicks, ctrPct: report.ads.ctrPct, cpcCents: report.ads.cpcCents } : null,
      campaigns: (report?.campaigns ?? []).map((c) => ({ ...c, signups: byCampaign.get(c.name.trim().toLowerCase()) ?? 0 })),
    },
    posts: briefPosts,
    socialVisits: { instagram: social("instagram"), tiktok: social("tiktok"), signups: signups.filter((row) => ["instagram", "tiktok", "meta (organisch)"].includes(src(row))).length },
    leadsDue: leadsDue.map((lead) => ({ name: lead.name || lead.domain, action: lead.next_action || "Opvolgen", when: new Date(lead.next_action_at as string).toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" }) })),
    followupsReady: followups.map((row) => ({ name: names.get(row.tenant_id) ?? "Werkruimte", step: row.step, subject: row.subject })),
    newLeads,
    backofficeUrl: `${SITE_ORIGIN}/backoffice?tab=opvolging`,
  };
}

export function renderBrief(input: BriefInput) {
  const brief = buildMorningBrief(input);
  const blocks = brief.blocks as MailBlock[];
  const html = renderBrandedEmail({ preheader: brief.preheader, eyebrow: "Ochtendbrief · marketing en sales", title: brief.title, blocks, signature: "Je marketingagent", footer: ["Alleen voor het SequenceFlow-team. Advertentievoorstellen worden pas uitgevoerd na jouw akkoord."] });
  const text = blocks.map((block) => {
    if (block.type === "heading") return `\n${block.text.toUpperCase()}`;
    if (block.type === "paragraph" || block.type === "note") return block.text;
    if (block.type === "stats" || block.type === "rows") return block.items.map((item) => `- ${item.label}: ${item.value}`).join("\n");
    if (block.type === "list") return block.items.map((item) => `- ${item.title}${item.text ? ` (${item.text})` : ""}`).join("\n");
    if (block.type === "button") return `${block.label}: ${block.href}`;
    return "";
  }).join("\n");
  return { ...brief, html, text: `${brief.title}\n${text}` };
}

/** Verstuurt de brief één keer per dag (backoffice_notifications), tenzij force. */
export async function sendMorningBrief(options: { force?: boolean; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const recipients = noticeRecipients(process.env);
  if (!recipients.length) return { sent: false, reason: "geen ontvangers (BACKOFFICE_NOTIFY_EMAILS of PLATFORM_ADMIN_EMAILS)" };
  const db = getSupabaseAdmin();
  if (!options.force) {
    const { data, error } = await db.from("backoffice_notifications").upsert({ kind: "morning_brief", ref: amsterdamDay(now.toISOString()), tenant_id: null }, { onConflict: "kind,ref", ignoreDuplicates: true }).select("id");
    if (error) return { sent: false, reason: `vastleggen mislukt: ${error.message}` };
    if (!data?.length) return { sent: false, reason: "vandaag al verstuurd" };
  }
  const mail = renderBrief(await collectBriefInput(now));
  await Promise.all(recipients.map((to) => sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html })));
  return { sent: true, recipients: recipients.length, proposals: mail.proposals.length };
}
