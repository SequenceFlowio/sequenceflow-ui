/**
 * De ochtendbrief voor Navaron: één mail per werkdag met de funnel, Meta-advertenties,
 * Instagram en TikTok en wie er vandaag opvolging nodig heeft. Advertentiewijzigingen
 * staan er alleen als voorstel in; er wordt niets aangepast. Geen netwerk of database.
 */

export type BriefFunnelWeek = { visits: number; signups: number; mailbox: number; draft: number; sent: number; paid: number };

export type BriefAds = {
  linked: boolean;
  error: string | null;
  totals: { spendCents: number; impressions: number; clicks: number; ctrPct: number; cpcCents: number } | null;
  campaigns: Array<{ name: string; spendCents: number; clicks: number; impressions: number; signups: number }>;
};

export type BriefPost = {
  platform: "instagram" | "facebook" | "tiktok";
  title: string;
  publishedAt: string;
  reach: number | null;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  follows: number;
  profileVisits: number;
  status?: string;
};

export type BriefInput = {
  now: string;
  thisWeek: BriefFunnelWeek;
  lastWeek: BriefFunnelWeek;
  bottleneck: { label: string; pct: number | null; target: number; advice: string } | null;
  /** Bezoeken en aanmeldingen van gisteren per bron (eigen meting). */
  yesterday: { visits: number; signups: number; bySource: Array<{ source: string; visits: number; signups: number }> };
  ads: BriefAds;
  posts: BriefPost[];
  /** Bezoeken uit Instagram en TikTok in de laatste 7 dagen (eigen meting): of content verkeer oplevert. */
  socialVisits: { instagram: number; tiktok: number; signups: number };
  leadsDue: Array<{ name: string; action: string; when: string }>;
  followupsReady: Array<{ name: string; step: number; subject: string }>;
  newLeads: number;
  backofficeUrl: string;
};

export type AdProposal = { campaign: string; change: string; why: string };

const eur = (cents: number) => `€${(cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const num = (value: number) => value.toLocaleString("nl-NL");
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/** Vaste regels voor advertentievoorstellen. Alleen voorstellen: uitvoeren pas na akkoord. */
export function adProposals(ads: BriefAds): AdProposal[] {
  if (!ads.linked || !ads.campaigns.length) return [];
  const out: AdProposal[] = [];
  for (const c of ads.campaigns) {
    const ctr = pct(c.clicks, c.impressions);
    const cpc = c.clicks ? Math.round(c.spendCents / c.clicks) : null;
    if (c.spendCents >= 3000 && c.signups === 0) {
      out.push({ campaign: c.name, change: "Pauzeren of de landingspagina wisselen", why: `${eur(c.spendCents)} uitgegeven in 7 dagen zonder één aanmelding (eigen meting).` });
    } else if (c.impressions >= 2000 && ctr !== null && ctr < 0.8) {
      out.push({ campaign: c.name, change: "Nieuwe hook of creative testen", why: `Doorklik ${ctr.toLocaleString("nl-NL")}% bij ${num(c.impressions)} vertoningen: de eerste seconden pakken niet.` });
    } else if (cpc !== null && cpc > 150 && c.clicks >= 20) {
      out.push({ campaign: c.name, change: "Doelgroep verbreden of bod verlagen", why: `${eur(cpc)} per klik is duur voor deze fase.` });
    } else if (c.signups >= 2 && c.spendCents > 0 && c.spendCents / c.signups <= 4000) {
      out.push({ campaign: c.name, change: "Budget 20% omhoog", why: `${c.signups} aanmeldingen voor ${eur(Math.round(c.spendCents / c.signups))} per stuk.` });
    }
  }
  return out;
}

function delta(now: number, before: number) {
  if (now === before) return "gelijk aan vorige week";
  const sign = now > before ? "+" : "−";
  return `${sign}${num(Math.abs(now - before))} t.o.v. vorige week`;
}

/** Kopersignalen tellen zwaarder dan bereik: reacties, profielbezoeken, volgers, bewaren. */
export function buyerSignals(post: BriefPost) {
  return post.comments * 3 + post.profileVisits * 2 + post.follows * 4 + post.saves * 2 + post.shares;
}

export function buildMorningBrief(input: BriefInput) {
  const date = new Date(input.now).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Amsterdam" });
  const proposals = adProposals(input.ads);
  const w = input.thisWeek;
  const lines: string[] = [];
  type Block =
    | { type: "heading"; text: string } | { type: "paragraph"; text: string } | { type: "note"; text: string }
    | { type: "stats"; items: Array<{ label: string; value: string }> } | { type: "rows"; items: Array<{ label: string; value: string }> }
    | { type: "list"; items: Array<{ title: string; text?: string }> } | { type: "button"; label: string; href: string };
  const blocks: Block[] = [];

  // Vandaag doen: eerst, want daar gaat het om.
  const todo = [
    ...input.followupsReady.map((f) => ({ title: `Mail dag ${f.step}: ${f.name}`, text: f.subject })),
    ...input.leadsDue.map((l) => ({ title: `${l.action}: ${l.name}`, text: l.when })),
  ];
  blocks.push({ type: "heading", text: "Vandaag doen" });
  if (todo.length) blocks.push({ type: "list", items: todo.slice(0, 12) });
  else blocks.push({ type: "paragraph", text: input.newLeads ? `Geen opvolging nodig. Er staan ${input.newLeads} nieuwe leads klaar om te beoordelen.` : "Geen opvolging nodig vandaag." });
  if (todo.length > 12) blocks.push({ type: "note", text: `En nog ${todo.length - 12} in de backoffice.` });
  lines.push(`${todo.length} acties vandaag`);

  // Funnel
  blocks.push({ type: "heading", text: "Funnel deze week" });
  blocks.push({ type: "stats", items: [
    { label: "Bezoeken", value: num(w.visits) },
    { label: "Aanmeldingen", value: num(w.signups) },
    { label: "Mailbox gekoppeld", value: num(w.mailbox) },
    { label: "Betaald", value: num(w.paid) },
  ] });
  blocks.push({ type: "rows", items: [
    { label: "Gisteren", value: `${num(input.yesterday.visits)} bezoeken, ${num(input.yesterday.signups)} aanmeldingen` },
    { label: "Bezoeken", value: delta(w.visits, input.lastWeek.visits) },
    { label: "Aanmeldingen", value: delta(w.signups, input.lastWeek.signups) },
    ...input.yesterday.bySource.slice(0, 4).map((s) => ({ label: `Gisteren via ${s.source}`, value: `${num(s.visits)} bezoeken${s.signups ? `, ${num(s.signups)} aanmeldingen` : ""}` })),
  ] });
  if (input.bottleneck) blocks.push({ type: "note", text: `Knelpunt: ${input.bottleneck.label} ${input.bottleneck.pct ?? "—"}% (doel ${input.bottleneck.target}%). ${input.bottleneck.advice}` });
  lines.push(`${num(w.signups)} aanmeldingen deze week`);

  // Meta-advertenties
  blocks.push({ type: "heading", text: "Meta-advertenties (7 dagen)" });
  if (!input.ads.linked) {
    blocks.push({ type: "note", text: "Niet gekoppeld: zet META_ADS_ACCESS_TOKEN (ads_read) en META_AD_ACCOUNT_ID in Vercel, dan staan hier uitgaven, kliks en voorstellen." });
  } else if (input.ads.error && !input.ads.totals) {
    blocks.push({ type: "note", text: `Meta gaf een fout: ${input.ads.error}` });
  } else if (input.ads.totals) {
    const t = input.ads.totals;
    const signups = input.ads.campaigns.reduce((sum, c) => sum + c.signups, 0);
    blocks.push({ type: "stats", items: [
      { label: "Uitgegeven", value: eur(t.spendCents) },
      { label: "Kliks", value: num(t.clicks) },
      { label: "Doorklik", value: `${t.ctrPct.toLocaleString("nl-NL")}%` },
      { label: "Per aanmelding", value: signups ? eur(Math.round(t.spendCents / signups)) : "—" },
    ] });
    if (proposals.length) {
      blocks.push({ type: "paragraph", text: "Voorstellen (ik voer niets uit zonder jouw akkoord):" });
      blocks.push({ type: "list", items: proposals.map((p) => ({ title: `${p.campaign}: ${p.change}`, text: p.why })) });
    } else blocks.push({ type: "paragraph", text: "Geen voorstellen: niets valt buiten de regels." });
    lines.push(`ads ${eur(t.spendCents)}`);
  }

  // Social
  blocks.push({ type: "heading", text: "Instagram en TikTok" });
  const recent = input.posts.filter((p) => Date.parse(input.now) - Date.parse(p.publishedAt) <= 7 * 86_400_000);
  const ig = recent.filter((p) => p.platform === "instagram");
  const tt = recent.filter((p) => p.platform === "tiktok");
  const failed = recent.filter((p) => p.status === "failed");
  blocks.push({ type: "rows", items: [
    { label: "Instagram (7 dagen)", value: `${ig.length} posts · ${num(ig.reduce((s, p) => s + (p.reach ?? 0), 0))} bereik · ${num(ig.reduce((s, p) => s + p.comments, 0))} reacties · ${num(ig.reduce((s, p) => s + p.follows, 0))} volgers erbij` },
    { label: "TikTok (7 dagen)", value: `${tt.length} posts${tt.some((p) => p.status === "published") ? ` · ${tt.filter((p) => p.status === "published").length} openbaar` : ""}` },
    { label: "Naar de site", value: `${num(input.socialVisits.instagram)} bezoeken uit Instagram, ${num(input.socialVisits.tiktok)} uit TikTok, ${num(input.socialVisits.signups)} aanmeldingen` },
  ] });
  const best = [...recent].sort((a, b) => buyerSignals(b) - buyerSignals(a))[0];
  if (best && buyerSignals(best) > 0) blocks.push({ type: "note", text: `Meeste kopersignalen (reacties, profielbezoek, volgers): "${best.title}" op ${best.platform}. Maak hier een variant van.` });
  if (failed.length) blocks.push({ type: "note", text: `${failed.length} post(s) niet gepubliceerd: kijk in /contentcalender.` });

  blocks.push({ type: "button", label: "Naar de backoffice", href: input.backofficeUrl });

  return {
    subject: `Ochtendbrief ${date}: ${lines.join(" · ")}`,
    preheader: lines.join(" · "),
    title: `Goedemorgen. ${date[0].toUpperCase()}${date.slice(1)}.`,
    blocks,
    proposals,
  };
}
