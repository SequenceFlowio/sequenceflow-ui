import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { adminState } from "@/lib/backoffice/auth";
import { getPayout } from "@/lib/referrals/payouts";

import { PayoutInvoice } from "../../../affiliate/PayoutInvoice";
import { PrintButton } from "../../../affiliate/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Factuur · SequenceFlow beheer", robots: { index: false, follow: false } };

/** Dezelfde factuur voor de eigen administratie. Alleen voor een ingelogde beheerder; anders bestaat de pagina niet. */
export default async function BackofficeInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  if ((await adminState()).state !== "ok") notFound();
  const payout = await getPayout((await params).id);
  if (!payout) notFound();
  return <PayoutInvoice payout={payout} printButton={<PrintButton />} />;
}
