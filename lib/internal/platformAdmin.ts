/**
 * Wie het interne dashboard mag zien: alleen e-mailadressen in
 * PLATFORM_ADMIN_EMAILS (kommagescheiden). Leeg = niemand.
 */
export function isPlatformAdminEmail(email: string | null | undefined, list = process.env.PLATFORM_ADMIN_EMAILS ?? "") {
  if (!email) return false;
  const allowed = list.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
