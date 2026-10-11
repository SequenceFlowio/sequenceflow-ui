/**
 * Talking to Gmail's forwarding confirmation page. Only https Google hosts are
 * ever fetched, also when Google redirects (mail-settings.google.com sends you
 * on to mail.google.com, where the Confirm form lives).
 */

const USER_AGENT = "Mozilla/5.0 (compatible; SequenceFlow/1.0)";
const MAX_REDIRECTS = 5;

export function isAllowedGoogleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "google.com" || url.hostname.endsWith(".google.com"));
  } catch {
    return false;
  }
}

export type ConfirmationForm = {
  action: string;
  fields: URLSearchParams;
};

function attribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

/** The page's POST form; an empty action posts back to the page itself. */
export function parseConfirmationForm(html: string, pageUrl: string): ConfirmationForm | null {
  const formMatch = html.match(/<form\b([^>]*)>([\s\S]*?)<\/form>/i);
  if (!formMatch) return null;

  const [, formAttributes, formBody] = formMatch;
  if ((attribute(formAttributes, "method") ?? "").toLowerCase() !== "post") return null;

  const rawAction = (attribute(formAttributes, "action") ?? "").replace(/&amp;/g, "&");
  const action = rawAction ? new URL(rawAction, pageUrl).toString() : pageUrl;
  if (!isAllowedGoogleUrl(action)) return null;

  const fields = new URLSearchParams();
  const inputRegex = /<input\b([^>]*)>/gi;
  let inputMatch: RegExpExecArray | null = null;
  while ((inputMatch = inputRegex.exec(formBody)) !== null) {
    const name = attribute(inputMatch[1], "name");
    if (!name) continue;
    fields.append(name, attribute(inputMatch[1], "value") ?? "");
  }
  return { action, fields };
}

export function looksConfirmed(html: string): boolean {
  const normalized = html.toLowerCase();
  return (
    normalized.includes("confirmation success") ||
    normalized.includes("may now forward") ||
    normalized.includes("bevestigd") ||
    normalized.includes("confirmed") ||
    normalized.includes("has been added") ||
    normalized.includes("heeft nu toestemming") ||
    normalized.includes("mag nu e-mail doorsturen")
  );
}

function setCookies(response: Response): string[] {
  if (typeof response.headers.getSetCookie === "function") return response.headers.getSetCookie();
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

/** Merges new Set-Cookie values into a cookie jar (name → "name=value"). */
export function mergeCookies(jar: Map<string, string>, cookies: string[]) {
  for (const cookie of cookies) {
    const pair = cookie.split(";")[0]?.trim() ?? "";
    const name = pair.split("=")[0];
    if (name) jar.set(name, pair);
  }
  return jar;
}

export type GooglePage = { url: string; status: number; html: string; cookies: Map<string, string> };

/**
 * Fetches a Google page and follows its redirects by hand, refusing any hop
 * that leaves Google. A POST that redirects continues as a GET, like a browser.
 */
export async function fetchGooglePage(
  url: string,
  options: { method?: "GET" | "POST"; body?: string; referer?: string; cookies?: Map<string, string> } = {},
): Promise<GooglePage> {
  const jar = new Map(options.cookies ?? []);
  let current = url;
  let method = options.method ?? "GET";
  let body = options.body;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedGoogleUrl(current)) throw new Error("Refusing to fetch a non-Google URL.");
    const cookieHeader = [...jar.values()].join("; ");
    const response = await fetch(current, {
      method,
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded", Origin: new URL(current).origin } : {}),
        ...(options.referer ? { Referer: options.referer } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: method === "POST" ? body ?? "" : undefined,
      signal: AbortSignal.timeout(15000),
    });
    mergeCookies(jar, setCookies(response));
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      method = "GET";
      body = undefined;
      continue;
    }
    return { url: current, status: response.status, html: await response.text(), cookies: jar };
  }
  throw new Error("Too many redirects from Google.");
}
