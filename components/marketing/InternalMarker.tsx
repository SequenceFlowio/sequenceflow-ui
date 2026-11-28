"use client";

import { useEffect } from "react";

import { INTERNAL_COOKIE } from "@/lib/marketing/attributionCore";

/**
 * Markeert deze browser als eigen verkeer (team, of een agent die de site test), zodat
 * bezoeken en aanmeldingen niet in de funnel tellen. De cookie staat op .sequenceflow.io,
 * dus één keer de backoffice openen geldt ook voor de website en de app.
 * Zelf aan- of uitzetten kan met ?intern=1 of ?intern=0 achter een willekeurige sitepagina.
 */
export function setInternalVisitor(on: boolean) {
  try {
    const host = window.location.hostname;
    const domain = host === "sequenceflow.io" || host.endsWith(".sequenceflow.io") ? "; domain=.sequenceflow.io" : "";
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = on
      ? `${INTERNAL_COOKIE}=1; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax${domain}${secure}`
      : `${INTERNAL_COOKIE}=; max-age=0; path=/; samesite=lax${domain}${secure}`;
  } catch {
    // Geen cookies mogelijk: dan telt dit bezoek gewoon mee.
  }
}

/** In de backoffice: wie hier binnen is, is van het team. */
export function InternalMarker() {
  useEffect(() => setInternalVisitor(true), []);
  return null;
}
