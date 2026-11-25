"use client";

import { useEffect } from "react";

import { annualBaseCents } from "@/lib/billingInterval";
import { PAID_PLAN_CATALOG } from "@/lib/planCatalog";

import { trackConversion } from "./TrackingTags";

const CONVERSION_COOKIE = "sf_conv";

/**
 * In de app (support.sequenceflow.io): een nieuwe aanmelding en een geslaagde betaling
 * één keer doorgeven aan GA4 en Meta, met de toestemming die de bezoeker op de site gaf.
 * Zonder toestemming gebeurt er niets; onze eigen meting telt de aanmelding dan toch.
 */
export function AppConversions() {
  useEffect(() => {
    // Aanmelding: de login zet sf_conv=sign_up (lib/auth/finishSignIn.ts).
    if (/(?:^|;\s*)sf_conv=sign_up/.test(document.cookie)) {
      document.cookie = `${CONVERSION_COOKIE}=; max-age=0; path=/`;
      trackConversion("sign_up");
    }
    // Betaling: Stripe stuurt terug naar /settings?tab=billing&checkout=success&plan=...
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      const plan = params.get("plan") ?? undefined;
      const key = `sf_purchase_tracked:${plan ?? ""}:${new Date().toISOString().slice(0, 10)}`;
      let seen = false;
      try { seen = window.sessionStorage.getItem(key) === "1"; window.sessionStorage.setItem(key, "1"); } catch { /* geen opslag: kan dubbel tellen bij herladen */ }
      if (!seen) {
        const monthly = PAID_PLAN_CATALOG.find((item) => item.id === plan)?.price;
        // Jaarbetaling: het hele jaarbedrag (met korting) als waarde; anders het maandbedrag.
        const price = monthly && params.get("interval") === "year" ? annualBaseCents(monthly * 100) / 100 : monthly;
        trackConversion("purchase", { plan, ...(price ? { value: price, currency: "EUR" } : {}) });
      }
    }
  }, []);
  return null;
}
