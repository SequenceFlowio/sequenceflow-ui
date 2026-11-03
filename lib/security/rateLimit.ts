import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { allowRequest as allowWith, type RateLimitRule } from "./rateLimitCore";

export { RATE_LIMITS, clientIp, dayKey, rateLimitKey, tooManyRequests, type RateLimitDeps, type RateLimitRule } from "./rateLimitCore";

/**
 * Rate limiting for public routes, backed by Postgres (migration 061) so
 * every serverless instance shares the same counter. An in-memory map only
 * limits one instance, which on Vercel is no limit at all.
 */
async function hitViaSupabase(key: string, limit: number, windowSeconds: number) {
  const { data, error } = await getSupabaseAdmin().rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data !== false;
}

/** True when the request is within the rule; false when it should get a 429. */
export function allowRequest(scope: string, id: string, rule: RateLimitRule) {
  return allowWith(scope, id, rule, { hit: hitViaSupabase });
}
