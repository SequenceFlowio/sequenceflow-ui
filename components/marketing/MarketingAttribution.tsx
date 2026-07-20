"use client";

import { useEffect } from "react";

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

export function MarketingAttribution({ page }: { page: string }) {
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const attribution = Object.fromEntries(
      ATTRIBUTION_KEYS.map((key) => [key, search.get(key)]).filter((entry) => Boolean(entry[1]))
    );
    const sessionId = window.sessionStorage.getItem("sf_marketing_session") ?? crypto.randomUUID();
    window.sessionStorage.setItem("sf_marketing_session", sessionId);

    void fetch("/api/marketing/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "landing_view",
        sessionId,
        path: page,
        referrer: document.referrer || null,
        ...attribution,
      }),
      keepalive: true,
    });
  }, [page]);

  return null;
}

export function trackMarketingCta(label: string, destination: string) {
  const sessionId = window.sessionStorage.getItem("sf_marketing_session") ?? crypto.randomUUID();
  window.sessionStorage.setItem("sf_marketing_session", sessionId);
  void fetch("/api/marketing/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "cta_click",
      sessionId,
      path: window.location.pathname,
      metadata: { label, destination },
    }),
    keepalive: true,
  });
}
