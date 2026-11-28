"use client";

import { useEffect } from "react";

import { setInternalVisitor } from "./InternalMarker";
import { TrackingTags, trackTagEvent } from "./TrackingTags";

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
    // ?intern=1 markeert deze browser als eigen verkeer, ?intern=0 haalt dat weg (vóór de meting hieronder).
    const intern = search.get("intern");
    if (intern === "1" || intern === "0") setInternalVisitor(intern === "1");
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

  // GA4 en de Meta-pixel: alleen als de id's zijn ingesteld en na toestemming.
  return <TrackingTags />;
}

export function trackMarketingCta(label: string, destination: string) {
  trackTagEvent(label, destination);
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
