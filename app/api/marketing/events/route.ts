import { NextResponse } from "next/server";

import {
  encodeAttribution,
  MARKETING_COOKIE,
  recordMarketingEvent,
  type MarketingAttribution,
} from "@/lib/marketing/attribution";

const PUBLIC_EVENTS = new Set(["landing_view", "cta_click"]);
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = optionalString(body.event);
  const sessionId = optionalString(body.sessionId);
  const path = optionalString(body.path);
  if (
    JSON.stringify(body).length > 4_000 ||
    !event ||
    !PUBLIC_EVENTS.has(event) ||
    !sessionId ||
    !SESSION_ID_PATTERN.test(sessionId) ||
    !path ||
    !path.startsWith("/") ||
    path.length > 300
  ) {
    return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
  }

  const rawMetadata = body.metadata && typeof body.metadata === "object"
    ? body.metadata as Record<string, unknown>
    : null;
  const metadata = rawMetadata
    ? {
        label: optionalString(rawMetadata.label)?.slice(0, 120) ?? null,
        destination: optionalString(rawMetadata.destination)?.slice(0, 300) ?? null,
      }
    : null;

  const attribution: MarketingAttribution = {
    sessionId,
    path,
    referrer: optionalString(body.referrer),
    utm_source: optionalString(body.utm_source),
    utm_medium: optionalString(body.utm_medium),
    utm_campaign: optionalString(body.utm_campaign),
    utm_content: optionalString(body.utm_content),
    utm_term: optionalString(body.utm_term),
    gclid: optionalString(body.gclid),
    fbclid: optionalString(body.fbclid),
  };

  try {
    await recordMarketingEvent({
      ...attribution,
      event: event as "landing_view" | "cta_click",
      metadata,
    });
  } catch (error) {
    console.error("[marketing/events] tracking failed", error);
  }

  const response = NextResponse.json({ ok: true }, { status: 202 });
  if (event === "landing_view") {
    response.cookies.set(MARKETING_COOKIE, encodeAttribution(attribution), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return response;
}
