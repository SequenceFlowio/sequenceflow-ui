import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const MARKETING_COOKIE = "sf_attribution";

export type MarketingAttribution = {
  sessionId: string;
  path: string;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
};

export type MarketingEvent = MarketingAttribution & {
  event: "landing_view" | "cta_click" | "signup_completed";
  userId?: string | null;
  tenantId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function truncate(value: string | null | undefined, max: number) {
  return value ? value.trim().slice(0, max) : null;
}

export async function recordMarketingEvent(input: MarketingEvent) {
  const { error } = await getSupabaseAdmin()
    .from("marketing_events")
    .upsert({
      event_name: input.event,
      session_id: input.sessionId,
      user_id: input.userId ?? null,
      tenant_id: input.tenantId ?? null,
      path: truncate(input.path, 300) ?? "/",
      referrer: truncate(input.referrer, 500),
      utm_source: truncate(input.utm_source, 100),
      utm_medium: truncate(input.utm_medium, 100),
      utm_campaign: truncate(input.utm_campaign, 160),
      utm_content: truncate(input.utm_content, 160),
      utm_term: truncate(input.utm_term, 160),
      gclid: truncate(input.gclid, 220),
      fbclid: truncate(input.fbclid, 220),
      metadata: input.metadata ?? {},
    }, { onConflict: "session_id,event_name,path", ignoreDuplicates: true });

  if (error) throw error;
}

export function encodeAttribution(input: MarketingAttribution) {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

export function decodeAttribution(value?: string | null): MarketingAttribution | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<MarketingAttribution>;
    if (typeof parsed.sessionId !== "string" || typeof parsed.path !== "string") return null;
    return parsed as MarketingAttribution;
  } catch {
    return null;
  }
}
