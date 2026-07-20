import crypto from "crypto";

export type ShopifyGraphQlEnvelope<T> = {
  data?: T;
  errors?: Array<{
    message?: string;
    extensions?: { code?: string };
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost?: number;
      throttleStatus?: { currentlyAvailable?: number; restoreRate?: number };
    };
  };
};

type ShopifyGraphQlRequest = {
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
  getAccessToken: (forceRefresh: boolean) => Promise<string>;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxRetries?: number;
};

export class ShopifyRequestError extends Error {
  readonly outcomeUnknown: boolean;

  constructor(message: string, outcomeUnknown = false) {
    super(message);
    this.name = "ShopifyRequestError";
    this.outcomeUnknown = outcomeUnknown;
  }
}

export function isUnknownShopifyMutationOutcome(error: unknown) {
  return error instanceof ShopifyRequestError && error.outcomeUnknown;
}

const defaultSleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, payload?: ShopifyGraphQlEnvelope<unknown>) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(5000, retryAfter * 1000);
  const cost = payload?.extensions?.cost;
  const requested = Number(cost?.requestedQueryCost ?? 1);
  const available = Number(cost?.throttleStatus?.currentlyAvailable ?? 0);
  const restoreRate = Math.max(1, Number(cost?.throttleStatus?.restoreRate ?? 50));
  return Math.min(5000, Math.max(100, Math.ceil(((requested - available) / restoreRate) * 1000)));
}

export async function shopifyGraphQlRequest<T>(input: ShopifyGraphQlRequest): Promise<T> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const sleep = input.sleep ?? defaultSleep;
  const maxRetries = input.maxRetries ?? 2;
  let token = await input.getAccessToken(false);
  let refreshed = false;
  const isMutation = /^\s*mutation\b/i.test(input.query);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(input.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query: input.query, variables: input.variables ?? {} }),
        cache: "no-store",
      });
    } catch {
      throw new ShopifyRequestError(
        isMutation
          ? "Shopify did not confirm whether the mutation was accepted."
          : "Shopify request failed before a response was received.",
        isMutation,
      );
    }
    if (response.status === 401 && !refreshed) {
      token = await input.getAccessToken(true);
      refreshed = true;
      continue;
    }
    if (response.status === 429 && attempt < maxRetries) {
      await sleep(retryDelay(response));
      continue;
    }
    const payload = await response.json().catch(() => ({})) as ShopifyGraphQlEnvelope<T>;
    const throttled = payload.errors?.some((error) => error.extensions?.code === "THROTTLED" || /throttled/i.test(error.message ?? ""));
    if (throttled && attempt < maxRetries) {
      await sleep(retryDelay(response, payload));
      continue;
    }
    if (!response.ok || payload.errors?.length || !payload.data) {
      const message = payload.errors?.map((error) => error.message).filter(Boolean).join("; ") || `Shopify request failed (${response.status}).`;
      const mutationOutcomeUnknown = isMutation && (
        response.status >= 500 || Boolean(payload.errors?.length) || (response.ok && !payload.data)
      );
      throw new ShopifyRequestError(message, mutationOutcomeUnknown);
    }
    return payload.data;
  }
  throw new Error("Shopify request exhausted its retry budget.");
}

export function verifyShopifyHmac(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
