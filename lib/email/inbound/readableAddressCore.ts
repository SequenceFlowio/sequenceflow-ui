/**
 * A readable forwarding address per workspace ("guardianbeauty@…") instead of
 * "t-<uuid>@…". Old t-<uuid> addresses keep working: resolveTenantFromAddress
 * still recognises them, so existing forwarding rules never break.
 */

const FREEMAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "live.nl", "icloud.com", "yahoo.com", "proton.me", "protonmail.com", "ziggo.nl", "kpnmail.nl"]);

export function slugForAddress(value: string) {
  return value
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

/** Best readable name: the Shopify shop, else the support domain, else the mailbox name. */
export function readableAddressBase(input: { shopDomain?: string | null; supportEmail?: string | null; tenantName?: string | null }) {
  const shop = input.shopDomain?.replace(/\.myshopify\.com$/i, "");
  if (shop) return slugForAddress(shop);
  const email = (input.supportEmail ?? "").trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (domain && !FREEMAIL.has(domain) && !domain.endsWith("sequenceflow.io")) return slugForAddress(domain.split(".").slice(0, -1).join("-") || domain);
  if (local && domain && FREEMAIL.has(domain)) return slugForAddress(local);
  const name = input.tenantName ?? "";
  // Generated placeholder names ("Tenant f9d4da74") are not worth showing.
  return /^tenant [0-9a-f]+$/i.test(name.trim()) ? "" : slugForAddress(name);
}

/** Candidates in order: name, name-2, name-3 … (the UNIQUE index decides). */
export function readableAddressCandidates(base: string, domain: string, count = 5) {
  if (base.length < 3) return [];
  return Array.from({ length: count }, (_, index) => `${index === 0 ? base : `${base}-${index + 1}`}@${domain}`);
}

export function isGeneratedInboundAddress(address: string | null | undefined) {
  return /^t-[0-9a-f-]{36}@/i.test(address ?? "");
}
