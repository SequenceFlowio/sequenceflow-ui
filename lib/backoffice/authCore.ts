/**
 * Wie het beheerdashboard (sequenceflow.io/backoffice) mag zien. Zonder imports
 * met een alias, zodat de tests dit bestand kunnen laden.
 *
 * Drie voorwaarden, alle drie uit het ondertekende sessietoken:
 * 1. het e-mailadres staat in PLATFORM_ADMIN_EMAILS;
 * 2. de sessie is bevestigd met een authenticator-app (aal2);
 * 3. die bevestiging is niet ouder dan MFA_MAX_AGE_SECONDS.
 */

export const MFA_MAX_AGE_SECONDS = 12 * 60 * 60;

export type AdminClaims = {
  email?: unknown;
  aal?: unknown;
  amr?: unknown;
};

export type AdminState =
  | { state: "signed_out" }
  | { state: "not_admin" }
  /** Ingelogd met de e-mailcode, authenticator nog niet (of te lang geleden) bevestigd. */
  | { state: "needs_mfa"; email: string }
  | { state: "ok"; email: string };

export function adminEmails(list: string | undefined | null) {
  return (list ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, list: string | undefined | null) {
  return Boolean(email) && adminEmails(list).includes(email!.trim().toLowerCase());
}

/** Tijdstip (seconden) van de laatste authenticator-bevestiging; null als dat niet in het token staat. */
function totpTimestamp(amr: unknown): number | null | "untimed" {
  if (!Array.isArray(amr)) return null;
  let latest: number | null = null;
  let untimed = false;
  for (const entry of amr) {
    if (entry === "totp" || entry === "mfa") untimed = true;
    if (entry && typeof entry === "object" && (entry as { method?: unknown }).method === "totp") {
      const timestamp = (entry as { timestamp?: unknown }).timestamp;
      if (typeof timestamp === "number") latest = Math.max(latest ?? 0, timestamp);
      else untimed = true;
    }
  }
  return latest ?? (untimed ? "untimed" : null);
}

export function evaluateAdminClaims(claims: AdminClaims | null | undefined, list: string | undefined | null, nowSeconds = Math.floor(Date.now() / 1000)): AdminState {
  if (!claims) return { state: "signed_out" };
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!isAdminEmail(email, list)) return { state: "not_admin" };
  if (claims.aal !== "aal2") return { state: "needs_mfa", email };
  const confirmed = totpTimestamp(claims.amr);
  if (confirmed === null) return { state: "needs_mfa", email };
  if (confirmed !== "untimed" && nowSeconds - confirmed > MFA_MAX_AGE_SECONDS) return { state: "needs_mfa", email };
  return { state: "ok", email };
}

/** Alleen cijfers, zodat "123 456" uit een mail of app ook werkt. */
export function cleanCode(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 10) : "";
}
