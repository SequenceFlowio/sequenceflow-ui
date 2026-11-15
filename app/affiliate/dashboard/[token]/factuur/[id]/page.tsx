import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { affiliateByToken, getPayout } from "@/lib/referrals/payouts";

import { PayoutInvoice } from "../../../../PayoutInvoice";
import { PrintButton } from "../../../../PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Factuur | SequenceFlow", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Factuur van één uitbetaling, voor de affiliate zelf. Alleen met de eigen dashboardlink. */
export default async function AffiliateInvoicePage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const affiliate = await affiliateByToken(token).catch(() => null);
  const payout = affiliate ? await getPayout(id, affiliate.id) : null;
  if (!payout) notFound();
  return <PayoutInvoice payout={payout} printButton={<PrintButton />} />;
}
