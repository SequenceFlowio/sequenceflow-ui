/**
 * Rekenregels voor het uitbetalen van affiliates, zonder database of imports
 * met een alias, zodat ze los te testen zijn. Bedragen in centen.
 */

export const PAYOUT_VAT_RATE = 0.21;

/** Spaties eruit, hoofdletters: "nl91 abna 0417 1643 00" → "NL91ABNA0417164300". */
export function normalizeIban(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Controle op vorm en controlegetal (ISO 13616, modulo 97). Zegt niets over of de rekening bestaat. */
export function isValidIban(value: string) {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = char >= "A" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** "NL91 ABNA 0417 1643 00" */
export function formatIban(value: string) {
  return normalizeIban(value).replace(/(.{4})/g, "$1 ").trim();
}

/** Wat een affiliate en de lijst in het beheerdashboard zien: alleen land en laatste vier tekens. */
export function maskIban(country: string, last4: string) {
  return `${country}•• •••• •••• ${last4}`;
}

/** Btw komt er alleen bovenop voor een ondernemer met een btw-nummer; particulieren krijgen het bedrag zonder btw. */
export function payoutAmounts(amountCents: number, affiliate: { isBusiness: boolean; vatNumber?: string | null }) {
  const vatCents = affiliate.isBusiness && affiliate.vatNumber?.trim() ? Math.round(amountCents * PAYOUT_VAT_RATE) : 0;
  return { amountCents, vatCents, totalCents: amountCents + vatCents };
}

/** Factuurnummer van de self-billingfactuur: SB-2026-0007. */
export function payoutInvoiceNumber(number: number, paidAt: string) {
  return `SB-${new Date(paidAt).getUTCFullYear()}-${String(number).padStart(4, "0")}`;
}
