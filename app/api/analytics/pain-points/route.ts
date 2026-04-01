import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getTenantId } from "@/lib/tenant";
import { getTenantPlan, AUTO_SEND_PLANS } from "@/lib/billing";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function runAnalysis(tenantId: string) {
  const supabase = getSupabaseAdmin();

  // Fetch tickets from last 30 days
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tickets } = await supabase
    .from("tickets")
    .select("subject, body_text, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", since30)
    .order("created_at", { ascending: false });

  if (!tickets || tickets.length < 5) {
    return { insufficient: true };
  }

  const weekCount = tickets.filter(t => t.created_at >= since7).length;
  const count     = tickets.length;

  // Cap at 50 tickets to control token usage
  const sample = tickets.slice(0, 50);
  const ticketLines = sample
    .map(t => `Subject: ${t.subject ?? "(geen onderwerp)"} | Message: ${(t.body_text ?? "").slice(0, 200)}`)
    .join("\n");

  const prompt = `You are a sharp customer experience analyst for a Dutch e-commerce seller.

Below are ${count} customer support emails from the past 30 days (this week: ${weekCount}).
Each line is: "Subject: ... | Message: ..."

Generate TWO things:

─── 1. INTRO ───────────────────────────────────────────
A short, punchy weekly briefing in Dutch. Max 3 sentences.
- Start with the volume & trend (up/down vs last week)
- Call out the biggest pain point immediately
- End with one actionable tip the seller can act on today
Tone: direct, no fluff, like a smart colleague — NOT corporate

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

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    intro: string;
    pain_points: Array<{
      category: string;
      count: number;
      percentage: number;
      description: string;
      example: string;
    }>;
  };

  // Persist to cache
  const { data: row } = await supabase
    .from("pain_point_analyses")
    .insert({
      tenant_id:    tenantId,
      ticket_count: count,
      week_count:   weekCount,
      pain_points:  parsed.pain_points ?? [],
      intro:        parsed.intro ?? "",
    })
    .select()
    .single();

  return {
    id:           row?.id,
    generated_at: row?.generated_at,
    ticket_count: count,
    week_count:   weekCount,
    intro:        parsed.intro ?? "",
    pain_points:  parsed.pain_points ?? [],
  };
}

async function handleRequest(req: NextRequest, forceRefresh: boolean) {
  try {
    const { tenantId } = await getTenantId(req);
    const { plan } = await getTenantPlan(tenantId);

    if (!AUTO_SEND_PLANS.includes(plan)) {
      return NextResponse.json({ error: "Pro plan required", upgrade: true }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    if (!forceRefresh) {
      // Check for fresh cache (< 24h)
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await supabase
        .from("pain_point_analyses")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("generated_at", cutoff)
        .order("generated_at", { ascending: false })
        .limit(1)
        .single();

      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const result = await runAnalysis(tenantId);

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
