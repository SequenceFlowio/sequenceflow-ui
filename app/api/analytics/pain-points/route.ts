import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import {
  evenlySample,
  PAIN_POINT_CACHE_MS,
  PAIN_POINT_PERIOD_DAYS,
  parsePainPointAnalysis,
  sanitizePainPointSource,
  type PainPointPeriod,
  type PainPointSource,
} from "@/lib/analytics/painPoints";
import { getTenantPlan, PAIN_POINT_PLANS } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_PERIODS = new Set<PainPointPeriod>(["daily", "weekly", "monthly", "quarterly"]);
const MAX_SAMPLE_SIZE = 75;

function parsePeriod(req: NextRequest): PainPointPeriod | null {
  const candidate = (new URL(req.url).searchParams.get("period") ?? "weekly") as PainPointPeriod;
  return VALID_PERIODS.has(candidate) ? candidate : null;
}

function buildDateRangeLabel(period: PainPointPeriod) {
  const now = new Date();
  const since = new Date(now.getTime() - PAIN_POINT_PERIOD_DAYS[period] * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
  if (period === "daily") return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(now);
  return `${formatter.format(since)} - ${formatter.format(now)}`;
}

async function loadSources(tenantId: string, period: PainPointPeriod) {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - PAIN_POINT_PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString();
  const [conversationResult, legacyResult] = await Promise.all([
    supabase.from("support_conversations")
      .select("id,subject_original,created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
    supabase.from("tickets")
      .select("subject,body_text,created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
  ]);
  if (conversationResult.error) throw new Error(`Could not load conversations: ${conversationResult.error.message}`);
  if (legacyResult.error) throw new Error(`Could not load legacy tickets: ${legacyResult.error.message}`);

  const conversations = conversationResult.data ?? [];
  const conversationIds = conversations.map((conversation) => conversation.id);
  const messageResult = conversationIds.length
    ? await supabase.from("support_messages")
        .select("conversation_id,body_original,created_at")
        .in("conversation_id", conversationIds)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
    : { data: [] as Array<{ conversation_id: string; body_original: string | null; created_at: string }>, error: null };
  if (messageResult.error) throw new Error(`Could not load inbound messages: ${messageResult.error.message}`);

  const latestBodyByConversation = new Map<string, string | null>();
  for (const message of messageResult.data ?? []) {
    if (!latestBodyByConversation.has(message.conversation_id)) {
      latestBodyByConversation.set(message.conversation_id, message.body_original);
    }
  }

  const sources: PainPointSource[] = [
    ...conversations.map((conversation) => ({
      subject: conversation.subject_original,
      body_text: latestBodyByConversation.get(conversation.id) ?? null,
      created_at: conversation.created_at,
    })),
    ...(legacyResult.data ?? []).map((ticket) => ({
      subject: ticket.subject,
      body_text: ticket.body_text,
      created_at: ticket.created_at,
    })),
  ];

  return sources
    .map(sanitizePainPointSource)
    .filter((source): source is NonNullable<typeof source> => Boolean(source))
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

async function runAnalysis(tenantId: string, period: PainPointPeriod) {
  const sources = await loadSources(tenantId, period);
  const minimum = period === "daily" ? 3 : 5;
  if (sources.length < minimum) return { insufficient: true as const, ticketCount: sources.length, minimum };

  const sampled = evenlySample(sources, MAX_SAMPLE_SIZE);
  const periodLabel = buildDateRangeLabel(period);
  const input = sampled.map((source, index) => (
    `${index + 1}. Onderwerp: ${source.subject} | Bericht: ${source.message || "(geen berichttekst)"}`
  )).join("\n");

  const prompt = `Je bent een scherpe customer-experience-analist voor een Nederlandse e-commercewinkel.

De onderstaande ${sampled.length} klantvragen zijn vooraf gepseudonimiseerd en representatief verdeeld over ${periodLabel}.

Maak:
1. Een briefing van maximaal drie Nederlandse zinnen: volume, grootste knelpunt en een concrete actie voor vandaag.
2. De vijf tot zeven belangrijkste, onderscheidende klantproblemen.

Regels:
- Deel iedere invoer exact eenmaal in. De aantallen moeten samen exact ${sampled.length} zijn.
- Gebruik pijn-gerichte categorienamen van maximaal vier woorden.
- Beschrijf alleen patronen. Kopieer of citeer nooit tekst uit een klantbericht.
- Neem geen namen, e-mailadressen, ordernummers, telefoonnummers, adressen of andere persoonsgegevens over.
- Geef per probleem één korte, concrete aanbevolen actie voor het support- of operationele team.
- Geef geen percentage; dat berekent SequenceFlow zelf.

Antwoord uitsluitend met JSON:
{
  "intro": "...",
  "pain_points": [
    {
      "category": "Retour blijft stil",
      "count": 3,
      "description": "Klanten missen een bevestiging of voortgang na hun retour.",
      "recommended_action": "Stuur direct na registratie automatisch een retourbevestiging."
    }
  ]
}

Klantvragen:
${input}`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Pain point analysis returned no content");
  const analysis = parsePainPointAnalysis(JSON.parse(raw), sampled.length);
  const generatedAt = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase.from("pain_point_analyses").upsert({
    tenant_id: tenantId,
    period,
    date_range_label: periodLabel,
    generated_at: generatedAt,
    ticket_count: sources.length,
    sampled_ticket_count: sampled.length,
    week_count: period === "weekly" ? sources.length : 0,
    pain_points: analysis.pain_points,
    intro: analysis.intro,
    analysis_version: 2,
  }, { onConflict: "tenant_id,period" }).select().single();
  if (error || !row) throw new Error(`Could not store pain point analysis: ${error?.message ?? "missing row"}`);
  return row;
}

async function handleRequest(req: NextRequest, forceRefresh: boolean) {
  try {
    const context = await getTenantId(req);
    if (forceRefresh && context.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { plan } = await getTenantPlan(context.tenantId);
    if (!PAIN_POINT_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Pro plan required", upgrade: true }, { status: 403 });
    }
    const period = parsePeriod(req);
    if (!period) return NextResponse.json({ error: "Invalid period" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    if (!forceRefresh) {
      const cutoff = new Date(Date.now() - PAIN_POINT_CACHE_MS[period]).toISOString();
      const { data: cached, error } = await supabase.from("pain_point_analyses")
        .select("*")
        .eq("tenant_id", context.tenantId)
        .eq("period", period)
        .eq("analysis_version", 2)
        .gte("generated_at", cutoff)
        .maybeSingle();
      if (error) throw new Error(`Could not load cached pain points: ${error.message}`);
      if (cached) return NextResponse.json({ ...cached, canRefresh: context.role === "admin" });
    }

    const result = await runAnalysis(context.tenantId, period);
    return NextResponse.json({ ...result, period, canRefresh: context.role === "admin" });
  } catch (error) {
    console.error("[pain-points]", error);
    return NextResponse.json({ error: "Klantpijnpunten konden niet worden geanalyseerd.", retryable: true }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req, false);
}

export async function POST(req: NextRequest) {
  return handleRequest(req, true);
}
