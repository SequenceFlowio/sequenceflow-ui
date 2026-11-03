/**
 * The waitlist "weer op voorraad", the pure part: who is on it and the mail
 * they get. The merchant confirms before anything is sent; see waitlist.ts.
 */

type Language = "nl" | "en";

export type WaitlistCustomer = { email: string; name: string | null; conversationId: string; sentAt: string | null };
export type Waitlist = { variantKey: string; variant: string; stock: number | null; customers: WaitlistCustomer[]; toSend: number; alreadySent: number };

const SAMPLE_DOMAINS = /@(demo-klant\.example|example\.(com|org|net)|[^@]+\.invalid)$/i;

/** One row per address, newest conversation first; sample and invalid addresses never make it. */
export function buildWaitlist(input: { variantKey: string; variant: string; stock: number | null; rows: Array<{ conversationId: string; email: string | null; name: string | null }>; sent: Array<{ email: string; sentAt: string }> }): Waitlist {
  const sentByEmail = new Map(input.sent.map((row) => [row.email.toLowerCase(), row.sentAt]));
  const seen = new Set<string>();
  const customers: WaitlistCustomer[] = [];
  for (const row of input.rows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || SAMPLE_DOMAINS.test(email) || seen.has(email)) continue;
    seen.add(email);
    customers.push({ email, name: row.name?.trim() || null, conversationId: row.conversationId, sentAt: sentByEmail.get(email) ?? null });
  }
  return {
    variantKey: input.variantKey,
    variant: input.variant,
    stock: input.stock,
    customers,
    toSend: customers.filter((customer) => !customer.sentAt).length,
    alreadySent: customers.filter((customer) => customer.sentAt).length,
  };
}

/** The mail, short and from the shop itself. `{naam}` is filled in per customer. */
export function waitlistEmail(input: { variant: string; shopName: string | null; shopUrl: string | null; language: Language }) {
  const nl = input.language === "nl";
  const shop = input.shopName ?? (nl ? "onze winkel" : "our shop");
  return {
    subject: nl ? `${input.variant} is weer op voorraad` : `${input.variant} is back in stock`,
    text: nl
      ? [
        "Hoi {naam},",
        "",
        `Je vroeg ons laatst wanneer ${input.variant} weer leverbaar zou zijn. Goed nieuws: hij is weer op voorraad${input.shopUrl ? `: ${input.shopUrl}` : "."}`,
        "",
        "De voorraad is beperkt, dus wees er op tijd bij. Heb je nog vragen, dan horen we het graag.",
        "",
        "Met vriendelijke groet,",
        shop,
      ].join("\n")
      : [
        "Hi {naam},",
        "",
        `You asked us when ${input.variant} would be available again. Good news: it is back in stock${input.shopUrl ? `: ${input.shopUrl}` : "."}`,
        "",
        "Stock is limited, so be quick. If you have any questions, just reply to this e-mail.",
        "",
        "Kind regards,",
        shop,
      ].join("\n"),
  };
}

/** Fills in the customer's name, or a plain greeting without one. */
export function personalize(text: string, name: string | null, language: Language) {
  const greeting = name ? name.split(/\s+/)[0] : "";
  return text.replace(/\{naam\}|\{name\}/g, greeting).replace(language === "nl" ? /^Hoi ,/m : /^Hi ,/m, language === "nl" ? "Hoi," : "Hi,");
}
