import crypto from "node:crypto";

/**
 * One check for every cron and worker route. Vercel Cron sends the secret as
 * `Authorization: Bearer <CRON_SECRET>`; `x-cron-secret` stays for manual
 * runs. The query string is deliberately not accepted: a secret in a URL
 * ends up in request logs and proxies.
 */
export function hasValidCronSecret(req: Request, secret = process.env.CRON_SECRET): boolean {
  const header = req.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : req.headers.get("x-cron-secret") ?? "";
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function unauthorizedCron() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
