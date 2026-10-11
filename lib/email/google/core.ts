import crypto from "node:crypto";

/**
 * Pure helpers for "Sign in with Google" (send only). No network or database
 * here, so they can be tested directly. See docs/plan-gmail-koppelen.md.
 */

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GOOGLE_SCOPES = ["openid", "email", GMAIL_SEND_SCOPE] as const;
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

export function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

/** Random state handed to Google; only its hash is stored. */
export function newOAuthState() {
  const state = base64url(crypto.randomBytes(32));
  return { state, stateHash: hashState(state) };
}

export function hashState(state: string) {
  return crypto.createHash("sha256").update(state).digest("hex");
}

/** PKCE (S256): the verifier stays on our server, Google only sees the challenge. */
export function newPkcePair() {
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildGoogleAuthUrl(input: { clientId: string; redirectUri: string; state: string; codeChallenge: string; loginHint?: string | null }) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  // offline + consent: Google only returns a refresh token on explicit consent.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
  return url.toString();
}

/** Google may grant fewer scopes than asked (granular consent); sending needs gmail.send. */
export function grantedSendScope(scope: string | null | undefined) {
  return (scope ?? "").split(/\s+/).includes(GMAIL_SEND_SCOPE);
}

export type GoogleIdentity = { sub: string; email: string };

/**
 * Reads the id_token we received straight from Google's token endpoint over
 * TLS with our client secret (OpenID Connect allows trusting it without a
 * signature check in that case). We still check issuer, audience and expiry.
 */
export function readIdToken(idToken: string, clientId: string, now = Date.now()): GoogleIdentity {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Google returned an invalid identity token");
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Google returned an invalid identity token");
  }
  const iss = String(claims.iss ?? "");
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") throw new Error("Identity token has the wrong issuer");
  const aud = claims.aud;
  if (aud !== clientId && !(Array.isArray(aud) && aud.includes(clientId))) throw new Error("Identity token is not for this app");
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now - 60_000) throw new Error("Identity token has expired");
  if (claims.email_verified !== true && claims.email_verified !== "true") throw new Error("This Google account's email address is not verified");
  const email = normalizeEmail(String(claims.email ?? ""));
  const sub = String(claims.sub ?? "");
  if (!email || !sub) throw new Error("Identity token has no email address");
  return { sub, email };
}

export function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

/** Gmail treats dots and +tags in gmail.com addresses as the same mailbox. */
export function sameMailbox(a: string | null | undefined, b: string | null | undefined) {
  const canon = (value: string | null | undefined) => {
    const email = normalizeEmail(value);
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    if (domain === "gmail.com" || domain === "googlemail.com") return `${local.split("+")[0].replaceAll(".", "")}@gmail.com`;
    return email;
  };
  const left = canon(a);
  return Boolean(left) && left === canon(b);
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/**
 * The address that asked Gmail to forward to us. Gmail's confirmation mail
 * names it ("x@gmail.com has requested to automatically forward mail…").
 * We take the first address that is neither ours nor Google's.
 */
export function forwardingRequester(input: { subject: string; text: string; recipient: string }) {
  const ours = normalizeEmail(input.recipient.match(/<([^>]+)>/)?.[1] ?? input.recipient);
  const candidates = `${input.subject}\n${input.text}`.match(EMAIL_RE) ?? [];
  for (const raw of candidates) {
    const email = normalizeEmail(raw);
    const domain = email.split("@")[1] ?? "";
    if (email === ours) continue;
    if (domain === "google.com" || domain.endsWith(".google.com")) continue;
    if (email.startsWith("forwarding-noreply@") || email.startsWith("noreply@")) continue;
    return email;
  }
  return null;
}

/** Only auto-confirm forwarding from a mailbox this workspace actually set up. */
export function forwardingAllowed(requester: string | null, knownAddresses: Array<string | null | undefined>) {
  if (!requester) return false;
  return knownAddresses.some((address) => sameMailbox(requester, address));
}

export function extractForwardingCode(text: string) {
  const explicit = text.match(/(?:confirmation|verification|bevestigings)(?:\s+|-)?code[^A-Z0-9]{0,12}([A-Z0-9-]{6,12})/i);
  if (explicit?.[1]) return explicit[1];
  return text.match(/\(#(\d{6,12})\)/)?.[1] ?? null;
}

/** Gmail API wants the full RFC 822 message, base64url without padding. */
export function gmailRawMessage(mime: Buffer | string) {
  return Buffer.from(mime).toString("base64url");
}

export class GoogleReconnectRequired extends Error {
  constructor(message = "Google access was revoked or expired. Sign in with Google again.") {
    super(message);
    this.name = "GoogleReconnectRequired";
  }
}

/** invalid_grant = refresh token revoked, expired (7 days in Google's testing mode) or password changed. */
export function isRevokedGrant(status: number, body: unknown) {
  const error = typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : "";
  return (status === 400 && error === "invalid_grant") || (status === 401 && error === "unauthorized_client");
}
