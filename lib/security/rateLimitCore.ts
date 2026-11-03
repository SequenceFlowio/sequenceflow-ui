/**
 * Pure part of the rate limiter (no imports with an alias, so tests can load
 * it). The Postgres-backed store lives in ./rateLimit.ts (migration 061), so
 * every serverless instance shares the same counter. An in-memory map only
 * limits one instance, which on Vercel is no limit at all.
 *
 * On a database error the request is allowed and the error is logged:
 * a broken limiter must not take the website down.
 */

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  marketingChat: { limit: 30, windowSeconds: 60 * 60 },
  marketingChatGlobalDaily: { limit: 2_000, windowSeconds: 24 * 60 * 60 },
  marketingForm: { limit: 5, windowSeconds: 60 * 60 },
  affiliateSignupIp: { limit: 5, windowSeconds: 60 * 60 },
  affiliateSignupEmail: { limit: 3, windowSeconds: 24 * 60 * 60 },
  contentLogin: { limit: 10, windowSeconds: 15 * 60 },
  mcpRegister: { limit: 20, windowSeconds: 60 * 60 },
  mcpToken: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitDeps = {
  hit: (key: string, limit: number, windowSeconds: number) => Promise<boolean>;
};

/** The caller's address as the platform reports it; "unknown" when absent. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Keys are hashed-free but bounded, so a long e-mail address cannot bloat the table. */
export function rateLimitKey(scope: string, id: string) {
  return `${scope}:${id.toLowerCase().slice(0, 200)}`;
}

/** True when the request is within the rule; false when it should get a 429. */
export async function allowRequest(
  scope: string,
  id: string,
  rule: RateLimitRule,
  deps: RateLimitDeps,
): Promise<boolean> {
  try {
    return await deps.hit(rateLimitKey(scope, id), rule.limit, rule.windowSeconds);
  } catch (error) {
    console.error(`[rate-limit] ${scope} check failed; allowing request`, error instanceof Error ? error.message : error);
    return true;
  }
}

/** Today's date as a key part, for a global daily cap. */
export function dayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function tooManyRequests(message: string, headers: Record<string, string> = {}) {
  return Response.json({ error: message }, { status: 429, headers: { "Retry-After": "60", ...headers } });
}
