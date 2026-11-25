/**
 * Regels voor de herkomst-cookie (sf_attribution), zonder imports met een alias zodat
 * ze los te testen zijn.
 */

const OWN_HOSTS = ["sequenceflow.io", "localhost"];

type Attribution = {
  referrer?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
};

/**
 * Op .sequenceflow.io, zodat de app (support.sequenceflow.io) bij het aanmelden leest
 * waar de bezoeker op www vandaan kwam. Zonder dat domein bleef de cookie op www en
 * telde geen enkele aanmelding een herkomst.
 */
export function attributionCookieOptions(host: string | null, secure: boolean) {
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    ...(hostname === "sequenceflow.io" || hostname.endsWith(".sequenceflow.io") ? { domain: ".sequenceflow.io" } : {}),
  };
}

function externalReferrer(referrer: string | null | undefined) {
  if (!referrer) return false;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return !OWN_HOSTS.some((own) => host === own || host.endsWith(`.${own}`));
  } catch {
    return false;
  }
}

/** Heeft dit bezoek een echte bron: een campagne, een advertentieklik of een andere site? */
export function hasSource(attribution: Attribution) {
  return Boolean(attribution.utm_source || attribution.utm_campaign || attribution.gclid || attribution.fbclid || externalReferrer(attribution.referrer));
}

/**
 * Een nieuwe pagina vervangt de bewaarde herkomst alleen als die een echte bron heeft, of
 * als er nog niets bewaard is. Anders maakt doorklikken binnen de site (van de homepage
 * naar Prijzen) van een Meta-bezoeker een "direct"-bezoeker.
 */
export function shouldReplaceAttribution(existing: Attribution | null, next: Attribution) {
  return !existing || hasSource(next);
}
