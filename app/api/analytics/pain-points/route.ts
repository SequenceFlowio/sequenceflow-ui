import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getTenantId } from "@/lib/tenant";
import { getTenantPlan, AUTO_SEND_PLANS } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Period = "daily" | "weekly" | "monthly";

const PERIOD_DAYS: Record<Period, number> = {
  daily:   1,
  weekly:  7,
  monthly: 30,
};

const CACHE_TTL_MS: Record<Period, number> = {
  daily:    1 * 60 * 60 * 1000,  // 1 h
  weekly:   6 * 60 * 60 * 1000,  // 6 h
  monthly: 24 * 60 * 60 * 1000,  // 24 h
};

const NL_MONTHS_SHORT = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
const NL_MONTHS_LONG  = ["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December"];

function buildDateRangeLabel(period: Period): string {
  const now  = new Date();
  const d    = now.getDate();
  const m    = NL_MONTHS_SHORT[now.getMonth()];
  const y    = now.getFullYear();

  if (period === "daily") {
    return `${d} ${m} ${y}`;
  }
  if (period === "weekly") {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return `${from.getDate()} ${NL_MONTHS_SHORT[from.getMonth()]} – ${d} ${m}`;
  }
  // monthly
  return `${NL_MONTHS_LONG[now.getMonth()]} ${y}`;
}

async function runAnalysis(tenantId: string, period: Period) {
  const supabase = getSupabaseAdmin();

  const days   = PERIOD_DAYS[period];
  const since  = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const label  = buildDateRangeLabel(period);

  const { data: tickets } = await supabase
    .from("tickets")
    .select("subject, body_text, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const MIN_TICKETS = period === "daily" ? 3 : 5;
  if (!tickets || tickets.length < MIN_TICKETS) {
    return { insufficient: true };
  }

  const count  = tickets.length;
  const sample = tickets.slice(0, 50);
  const ticketLines = sample
    .map(t => `Subject: ${t.subject ?? "(geen onderwerp)"} | Message: ${(t.body_text ?? "").slice(0, 200)}`)
    .join("\n");

  const periodLabel = period === "daily"
    ? `vandaag (${label})`
    : period === "weekly"
    ? `de afgelopen 7 dagen (${label})`
    : `de afgelopen 30 dagen (${label})`;

  const prompt = `You are a sharp customer experience analyst for a Dutch e-commerce seller.

Below are ${count} customer support emails from ${periodLabel}.
Each line is: "Subject: ... | Message: ..."

Generate TWO things:

─── 1. INTRO ───────────────────────────────────────────
A short, punchy briefing in Dutch. Max 3 sentences.
- Start with the volume for this specific period (${periodLabel})
- Call out the biggest pain point immediately
- End with one actionable tip the seller can act on today
Tone: direct, no fluff, like a smart colleague — NOT corporate
IMPORTANT: Only refer to the time period provided (${periodLabel}). Do not mention "deze week" unless the period is actually 7 days.

─── 2. PAIN POINTS ─────────────────────────────────────
Top 5–7 distinct customer problems.
- Category name: Dutch, max 4 words, pain-focused (not "Retourvragen" but "Retour niet bevestigd")
- Every email maps to exactly one category
- Counts must add up to exactly ${count}
- Example must be a real fragment from the emails

─── OUTPUT FORMAT ───────────────────────────────────────
Respond ONLY with this JSON, no explanation:
{
  "intro": "...",
  "pain_points": [
    {
      "category": "Retour niet bevestigd",
      "count": 42,
      "percentage": 34,
      "description": "Klanten sturen een retour op maar ontvangen geen bevestiging of update.",
      "example": "Ik heb mijn pakket 2 weken geleden teruggestuurd maar nog steeds niks gehoord."
    }
  ]
}

Emails:
${ticketLines}`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });

  const raw    = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    intro: string;
    pain_points: Array<{
      category: string; count: number; percentage: number;
      description: string; example: string;
    }>;
  };

  // Upsert — one row per (tenant_id, period)
  const { data: row } = await supabase
    .from("pain_point_analyses")
    .upsert(
      {
        tenant_id:        tenantId,
        period,
        date_range_label: label,
        ticket_count:     count,
        week_count:       period === "weekly" ? count : 0,
        pain_points:      parsed.pain_points ?? [],
        intro:            parsed.intro ?? "",
      },
      { onConflict: "tenant_id,period" }
    )
    .select()
    .single();

  return {
    id:               row?.id,
    generated_at:     row?.generated_at,
    period,
    date_range_label: label,
    ticket_count:     count,
    intro:            parsed.intro ?? "",
    pain_points:      parsed.pain_points ?? [],
  };
}

async function handleRequest(req: NextRequest, forceRefresh: boolean) {
  try {
    const { tenantId } = await getTenantId(req);
    const { plan }     = await getTenantPlan(tenantId);

    if (!AUTO_SEND_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Pro plan required", upgrade: true }, { status: 403 });
    }

    const url    = new URL(req.url);
    const period = (url.searchParams.get("period") ?? "weekly") as Period;
    if (!["daily","weekly","monthly"].includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (!forceRefresh) {
      const cutoff = new Date(Date.now() - CACHE_TTL_MS[period]).toISOString();
      const { data: cached } = await supabase
        .from("pain_point_analyses")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("period", period)
        .gte("generated_at", cutoff)
        .order("generated_at", { ascending: false })
        .limit(1)
        .single();

      if (cached) {
        return NextResponse.json({
          ...cached,
          date_range_label: cached.date_range_label ?? buildDateRangeLabel(period),
        });
      }
    }

    const result = await runAnalysis(tenantId, period);

    if ("insufficient" in result) {
      return NextResponse.json({ insufficient: true });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[pain-points]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req, false);
}

export async function POST(req: NextRequest) {
  return handleRequest(req, true);
}
