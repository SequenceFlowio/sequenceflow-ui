import { createHash, randomUUID } from "node:crypto";

import { sendEmail } from "@/lib/resend";
import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { formatIban, isValidIban, maskIban, normalizeIban, payoutAmounts, payoutInvoiceNumber } from "./payoutCore";
import { AFFILIATE, formatEuro } from "./program";

/**
 * Affiliates uitbetalen (migratie 072). De affiliate vult in zijn dashboard
 * een rekening in; een beheerder maakt het bedrag zelf over via de bank en
 * legt dat hier vast. Vastleggen zet de vrijgegeven commissieregels op betaald,
 * maakt de self-billingfactuur en mailt de affiliate. Er wordt hier geen geld
 * verplaatst.
 */

const db = () => getSupabaseAdmin();

type AffiliateRow = { id: string; username: string; name: string; email: string; is_business: boolean; company_name: string | null; kvk_number: string | null; vat_number: string | null; status: string };
type AccountRow = { affiliate_id: string; account_holder: string; iban_encrypted: string; iban_last4: string; updated_at: string };
type PayoutRow = { id: string; number: number; affiliate_id: string | null; amount_cents: number; vat_cents: number; total_cents: number; reward_count: number; reference: string | null; paid_by: string | null; paid_at: string; snapshot: PayoutSnapshot };

export type PayoutSnapshot = { username?: string; name?: string; email?: string; isBusiness?: boolean; companyName?: string | null; kvkNumber?: string | null; vatNumber?: string | null; accountHolder?: string; ibanMasked?: string };
export type Payout = { id: string; invoiceNumber: string; affiliateId: string | null; amountCents: number; vatCents: number; totalCents: number; rewardCount: number; reference: string | null; paidBy: string | null; paidAt: string; snapshot: PayoutSnapshot };
export type PayoutAccount = { accountHolder: string; ibanMasked: string; updatedAt: string };

const AFFILIATE_FIELDS = "id, username, name, email, is_business, company_name, kvk_number, vat_number, status";
const PAYOUT_FIELDS = "id, number, affiliate_id, amount_cents, vat_cents, total_cents, reward_count, reference, paid_by, paid_at, snapshot";

/** De tabellen van migratie 072 bestaan nog niet. */
function missingTable(error: { code?: string; message: string } | null) {
  return Boolean(error) && (error!.code === "42P01" || error!.code === "PGRST205" || /does not exist|schema cache/i.test(error!.message));
}

function toPayout(row: PayoutRow): Payout {
  return { id: row.id, invoiceNumber: payoutInvoiceNumber(row.number, row.paid_at), affiliateId: row.affiliate_id, amountCents: row.amount_cents, vatCents: row.vat_cents, totalCents: row.total_cents, rewardCount: row.reward_count, reference: row.reference, paidBy: row.paid_by, paidAt: row.paid_at, snapshot: row.snapshot ?? {} };
}

function toAccount(row: AccountRow): PayoutAccount {
  return { accountHolder: row.account_holder, ibanMasked: maskIban(row.iban_last4.slice(0, 2), row.iban_last4.slice(2)), updatedAt: row.updated_at };
}

/* ---------- Voor de affiliate zelf (dashboardlink) ---------- */

export async function affiliateByToken(token: string) {
  if (!token || token.length < 20) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await db().from("affiliates").select(AFFILIATE_FIELDS).eq("access_token_hash", hash).maybeSingle();
  return (data as AffiliateRow | null) ?? null;
}

/** Rekening en uitbetalingen van één affiliate. `ready` is false zolang migratie 072 niet is uitgevoerd. */
export async function affiliatePayoutOverview(affiliateId: string): Promise<{ ready: boolean; account: PayoutAccount | null; payouts: Payout[] }> {
  const [account, payouts] = await Promise.all([
    db().from("affiliate_payout_accounts").select("affiliate_id, account_holder, iban_encrypted, iban_last4, updated_at").eq("affiliate_id", affiliateId).maybeSingle(),
    db().from("affiliate_payouts").select(PAYOUT_FIELDS).eq("affiliate_id", affiliateId).order("paid_at", { ascending: false }).limit(60),
  ]);
  if (missingTable(account.error) || missingTable(payouts.error)) return { ready: false, account: null, payouts: [] };
  if (account.error) throw new Error(account.error.message);
  if (payouts.error) throw new Error(payouts.error.message);
  return { ready: true, account: account.data ? toAccount(account.data as AccountRow) : null, payouts: ((payouts.data ?? []) as PayoutRow[]).map(toPayout) };
}

export async function savePayoutAccount(affiliateId: string, input: { accountHolder: string; iban: string }) {
  const holder = input.accountHolder.trim().slice(0, 120);
  const iban = normalizeIban(input.iban);
  if (holder.length < 2) return { error: "Vul de naam van de rekeninghouder in." as const };
  if (!isValidIban(iban)) return { error: "Dit IBAN klopt niet. Controleer de cijfers en letters." as const };
  const { error } = await db().from("affiliate_payout_accounts").upsert({
    affiliate_id: affiliateId, account_holder: holder, iban_encrypted: encryptSecret(iban),
    // land + laatste vier tekens, genoeg om de rekening te herkennen zonder hem te tonen
    iban_last4: iban.slice(0, 2) + iban.slice(-4), updated_at: new Date().toISOString(),
  });
  if (missingTable(error)) return { error: "Rekening opslaan kan nog niet. Probeer het later opnieuw." as const };
  if (error) throw new Error(error.message);
  return { account: { accountHolder: holder, ibanMasked: maskIban(iban.slice(0, 2), iban.slice(-4)) } };
}

/** Eén uitbetaling, voor de factuur. Met `affiliateId` alleen als hij van die affiliate is. */
export async function getPayout(id: string, affiliateId?: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  let query = db().from("affiliate_payouts").select(PAYOUT_FIELDS).eq("id", id);
  if (affiliateId) query = query.eq("affiliate_id", affiliateId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return toPayout(data as PayoutRow);
}

/* ---------- Voor het beheerdashboard ---------- */

export type PayoutQueueRow = {
  affiliateId: string; username: string; name: string; email: string; isBusiness: boolean; vatNumber: string | null;
  amountCents: number; vatCents: number; totalCents: number; rewardCount: number;
  accountHolder: string | null; iban: string | null;
};

/**
 * Wie nu uitbetaald kan worden, met het volledige IBAN om over te maken, en de
 * laatste uitbetalingen. Alleen aanroepen voor een ingelogde beheerder.
 */
export async function payoutAdminOverview(): Promise<{ ready: boolean; queue: PayoutQueueRow[]; history: Payout[] }> {
  const [rewards, accounts, history] = await Promise.all([
    db().from("referral_rewards").select("affiliate_id, amount_cents").eq("kind", "affiliate_commission").eq("status", "available").not("affiliate_id", "is", null).limit(10_000),
    db().from("affiliate_payout_accounts").select("affiliate_id, account_holder, iban_encrypted, iban_last4, updated_at"),
    db().from("affiliate_payouts").select(PAYOUT_FIELDS).order("paid_at", { ascending: false }).limit(50),
  ]);
  if (missingTable(accounts.error) || missingTable(history.error)) return { ready: false, queue: [], history: [] };
  for (const result of [rewards, accounts, history]) if (result.error) throw new Error(result.error.message);

  const totals = new Map<string, { cents: number; count: number }>();
  for (const reward of (rewards.data ?? []) as Array<{ affiliate_id: string; amount_cents: number }>) {
    const total = totals.get(reward.affiliate_id) ?? { cents: 0, count: 0 };
    totals.set(reward.affiliate_id, { cents: total.cents + reward.amount_cents, count: total.count + 1 });
  }
  const due = [...totals.entries()].filter(([, total]) => total.cents >= AFFILIATE.minPayoutCents);
  const { data: affiliates, error } = due.length
    ? await db().from("affiliates").select(AFFILIATE_FIELDS).in("id", due.map(([id]) => id))
    : { data: [] as AffiliateRow[], error: null };
  if (error) throw new Error(error.message);
  const accountBy = new Map(((accounts.data ?? []) as AccountRow[]).map((row) => [row.affiliate_id, row]));

  const queue = due.flatMap(([id, total]): PayoutQueueRow[] => {
    const affiliate = (affiliates as AffiliateRow[]).find((row) => row.id === id);
    if (!affiliate) return [];
    const account = accountBy.get(id);
    let iban: string | null = null;
    try {
      iban = account ? formatIban(decryptSecret(account.iban_encrypted)) : null;
    } catch (cause) {
      console.error("[payouts] IBAN ontsleutelen mislukt", cause instanceof Error ? cause.message : cause);
    }
    return [{
      affiliateId: id, username: affiliate.username, name: affiliate.name, email: affiliate.email, isBusiness: affiliate.is_business, vatNumber: affiliate.vat_number,
      ...payoutAmounts(total.cents, { isBusiness: affiliate.is_business, vatNumber: affiliate.vat_number }), rewardCount: total.count,
      accountHolder: account?.account_holder ?? null, iban,
    }];
  }).sort((a, b) => b.totalCents - a.totalCents);

  return { ready: true, queue, history: ((history.data ?? []) as PayoutRow[]).map(toPayout) };
}

/**
 * Legt vast dat een affiliate is uitbetaald: alle vrijgegeven commissie in één
 * keer. Eerst de regels claimen, dan pas de uitbetaling boeken, zodat twee
 * klikken nooit dubbel uitbetalen.
 */
export async function recordAffiliatePayout(input: { affiliateId: string; paidBy: string; reference?: string | null }) {
  const { data: affiliate } = await db().from("affiliates").select(AFFILIATE_FIELDS).eq("id", input.affiliateId).maybeSingle();
  if (!affiliate) return { error: "Deze affiliate bestaat niet." as const };
  const row = affiliate as AffiliateRow;
  const { data: account, error: accountError } = await db().from("affiliate_payout_accounts").select("affiliate_id, account_holder, iban_encrypted, iban_last4, updated_at").eq("affiliate_id", row.id).maybeSingle();
  if (missingTable(accountError)) return { error: "Uitbetalen staat nog niet aan: migratie 072 is nog niet uitgevoerd." as const };
  if (!account) return { error: "Deze affiliate heeft nog geen rekening ingevuld." as const };

  const payoutId = randomUUID();
  const now = new Date().toISOString();
  const release = () => db().from("referral_rewards").update({ status: "available", settled_at: null, settlement_ref: null }).eq("settlement_ref", payoutId);

  const { data: claimed, error: claimError } = await db().from("referral_rewards")
    .update({ status: "paid", settled_at: now, settlement_ref: payoutId })
    .eq("kind", "affiliate_commission").eq("affiliate_id", row.id).eq("status", "available")
    .select("id, amount_cents");
  if (claimError) throw new Error(claimError.message);
  const amount = (claimed ?? []).reduce((sum, reward) => sum + (reward.amount_cents as number), 0);
  if (!claimed?.length || amount < AFFILIATE.minPayoutCents) {
    await release();
    return { error: `Er staat minder dan ${formatEuro(AFFILIATE.minPayoutCents)} klaar voor deze affiliate.` as const };
  }

  const amounts = payoutAmounts(amount, { isBusiness: row.is_business, vatNumber: row.vat_number });
  const accountRow = account as AccountRow;
  const snapshot: PayoutSnapshot = {
    username: row.username, name: row.name, email: row.email, isBusiness: row.is_business, companyName: row.company_name, kvkNumber: row.kvk_number, vatNumber: row.vat_number,
    accountHolder: accountRow.account_holder, ibanMasked: toAccount(accountRow).ibanMasked,
  };
  const { data: created, error: insertError } = await db().from("affiliate_payouts").insert({
    id: payoutId, affiliate_id: row.id, amount_cents: amounts.amountCents, vat_cents: amounts.vatCents, total_cents: amounts.totalCents,
    reward_count: claimed.length, reference: input.reference?.trim().slice(0, 140) || null, paid_by: input.paidBy, paid_at: now, snapshot,
  }).select(PAYOUT_FIELDS).single();
  if (insertError || !created) {
    await release();
    throw new Error(insertError?.message ?? "Uitbetaling opslaan mislukt");
  }
  const payout = toPayout(created as PayoutRow);

  try {
    await sendEmail({
      to: row.email,
      subject: `Je commissie is uitbetaald: ${formatEuro(payout.totalCents)}`,
      text: [
        `Hoi ${row.name.split(" ")[0]},`,
        "",
        `We hebben ${formatEuro(payout.totalCents)} overgemaakt naar rekening ${snapshot.ibanMasked} op naam van ${snapshot.accountHolder}.`,
        payout.vatCents ? `Dat is ${formatEuro(payout.amountCents)} commissie plus ${formatEuro(payout.vatCents)} btw.` : `Dat is ${formatEuro(payout.amountCents)} commissie.`,
        `Factuurnummer: ${payout.invoiceNumber}. De factuur staat in je dashboard (de link uit je aanmeldmail), onder Uitbetalingen.`,
        "",
        "Het kan één tot twee werkdagen duren voor het bedrag op je rekening staat.",
        "",
        "Vragen? Antwoord op deze mail of mail hallo@sequenceflow.io.",
        "",
        "Team SequenceFlow",
      ].join("\n"),
      replyTo: "hallo@sequenceflow.io",
    });
  } catch (error) {
    console.error("[payouts] mail aan affiliate mislukt", error instanceof Error ? error.message : error);
  }
  return { payout };
}
