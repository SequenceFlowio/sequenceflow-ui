"use client";

import { useEffect, useState } from "react";

/**
 * Google Analytics 4 en de Meta-pixel op de website. Staat uit tot de id's in
 * Vercel staan (NEXT_PUBLIC_GA_MEASUREMENT_ID, NEXT_PUBLIC_META_PIXEL_ID) en
 * laadt pas nadat de bezoeker toestemming geeft: beide plaatsen cookies van
 * derden. Zonder id's toont deze component niets en laadt hij niets.
 *
 * De eigen bezoekmeting (MarketingAttribution) werkt zonder cookies van derden
 * en loopt altijd door.
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.replace(/\D/g, "") ?? "";
const CONSENT_KEY = "sf_tracking_consent";

type Tracker = ((...args: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...args: unknown[]) => void; loaded?: boolean; version?: string; push?: unknown };
type TrackingWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: Tracker; _fbq?: Tracker; __sfTagsLoaded?: boolean };

function readConsent(): "granted" | "denied" | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function addScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function loadTags() {
  const w = window as TrackingWindow;
  if (w.__sfTagsLoaded) return;
  w.__sfTagsLoaded = true;

  if (GA_ID) {
    w.dataLayer = w.dataLayer ?? [];
    // gtag verwacht het arguments-object zelf, geen kopie.
    // eslint-disable-next-line prefer-rest-params
    w.gtag = function gtag() { w.dataLayer!.push(arguments); };
    w.gtag("js", new Date());
    w.gtag("config", GA_ID, { anonymize_ip: true });
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);
  }

  if (PIXEL_ID && !w.fbq) {
    const fbq: Tracker = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    w.fbq = fbq;
    w._fbq = fbq;
    addScript("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", PIXEL_ID);
    fbq("track", "PageView");
  }
}

/** Een klik op een knop, doorgegeven aan GA4 en Meta als die geladen zijn (dus alleen na toestemming). */
export function trackTagEvent(label: string, destination: string) {
  const w = window as TrackingWindow;
  const signup = /login|auth|start|proef|trial/i.test(`${destination} ${label}`);
  w.gtag?.("event", signup ? "generate_lead" : "cta_click", { label, destination });
  w.fbq?.(signup ? "track" : "trackCustom", signup ? "Lead" : "CtaClick", { label });
}

export function TrackingTags() {
  const [ask, setAsk] = useState(false);
  const [english, setEnglish] = useState(false);

  useEffect(() => {
    if (!GA_ID && !PIXEL_ID) return;
    const consent = readConsent();
    if (consent === "granted") loadTags();
    // Pas na het laden van de pagina tonen: de server weet niet wat de bezoeker eerder koos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (consent === null) { setEnglish(/(^|\/)en(\/|$)/.test(window.location.pathname)); setAsk(true); }
  }, []);

  if (!ask) return null;

  function choose(value: "granted" | "denied") {
    try { window.localStorage.setItem(CONSENT_KEY, value); } catch { /* privévenster: keuze geldt voor deze pagina */ }
    setAsk(false);
    if (value === "granted") loadTags();
  }

  return (
    <div role="dialog" aria-label={english ? "Cookies" : "Cookies"} style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 60, maxWidth: 520, marginLeft: "auto", padding: "16px 18px", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#141414", color: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,.5)", fontSize: 13, lineHeight: 1.5 }}>
      <p style={{ margin: "0 0 12px" }}>
        {english
          ? "May we measure which ads and pages work, with Google Analytics and Meta? Without your yes we only count anonymous visits."
          : "Mogen we meten welke advertenties en pagina's werken, met Google Analytics en Meta? Zonder je ja tellen we alleen anonieme bezoeken."}
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={() => choose("denied")} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,.22)", background: "transparent", color: "#fff", font: "inherit", fontWeight: 600, cursor: "pointer" }}>
          {english ? "No thanks" : "Liever niet"}
        </button>
        <button type="button" onClick={() => choose("granted")} style={{ padding: "8px 14px", borderRadius: 10, border: 0, background: "#C7F56F", color: "#0a0a0a", font: "inherit", fontWeight: 700, cursor: "pointer" }}>
          {english ? "Yes, that's fine" : "Ja, prima"}
        </button>
      </div>
    </div>
  );
}
