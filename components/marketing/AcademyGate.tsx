"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ACADEMY_LIBRARY } from "@/lib/marketing/academy/catalog";

import { FreebieGate } from "./FreebieGate";

/**
 * De aanmelding op /nl/academy en /en/academy. Na invullen (of met de link uit
 * de mail, of als je je hier al eerder aanmeldde) ga je meteen door naar de
 * pagina met alle video's.
 */
export function AcademyGate({ lang }: { lang: "nl" | "en" }) {
  const nl = lang === "nl";
  const router = useRouter();
  const go = useCallback(() => {
    const keep = new URLSearchParams(window.location.search);
    keep.delete("t");
    const query = keep.toString();
    router.replace(`${ACADEMY_LIBRARY[lang]}${query ? `?${query}` : ""}`);
  }, [router, lang]);
  return (
    <FreebieGate
      freebie="academy"
      lang={lang}
      onUnlock={go}
      lockedNote={nl ? "Gratis · zonder account" : "Free · no account needed"}
      title={nl ? "Krijg gratis toegang" : "Get free access"}
      sub={nl ? "Vul je e-mail in, bevestig met de code die je per mail krijgt en je gaat meteen naar alle video's." : "Enter your email, confirm with the code we email you and you'll go straight to all the videos."}
      button={nl ? "Bekijk de video's" : "Watch the videos"}
    >
      <p className="ac-onlist" role="status">{nl ? "Even geduld, we openen de video's…" : "One moment, opening the videos…"}</p>
    </FreebieGate>
  );
}
