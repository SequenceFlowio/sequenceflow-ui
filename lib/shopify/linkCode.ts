import { createHash, randomInt } from "node:crypto";

/** Unambiguous characters only: no 0/O, 1/I/L. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SHOPIFY_LINK_CODE_TTL_MS = 15 * 60 * 1000;

/** A one-time code like "K7PM-3QXR" that an existing workspace admin shares with the Shopify app. */
export function createShopifyLinkCode() {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Normalise what people type (spaces, lowercase, missing dash) before hashing. */
export function normalizeShopifyLinkCode(input: string) {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length !== 8 || [...compact].some((char) => !ALPHABET.includes(char))) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function hashShopifyLinkCode(code: string) {
  const normalized = normalizeShopifyLinkCode(code);
  if (!normalized) throw new Error("Invalid link code format");
  return createHash("sha256").update(normalized).digest("hex");
}
