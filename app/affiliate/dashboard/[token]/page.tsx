import type { Metadata } from "next";

import { SitePage } from "@/components/marketing/SitePage";
import { AFFILIATE, affiliateRate, formatEuro } from "@/lib/referrals/program";
import { affiliateByToken, affiliatePayoutOverview } from "@/lib/referrals/payouts";
import { affiliateDashboard } from "@/lib/referrals/server";
import { SITE_ORIGIN } from "@/lib/site";

import "../../affiliate.css";
import { PayoutAccountForm } from "./PayoutAccountForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Affiliatedashboard | SequenceFlow", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Persoonlijk dashboard van een affiliate. De link uit de aanmeldmail is de sleutel. */
export default async function AffiliateDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await affiliateDashboard(token).catch(() => null);
  if (!data) {
    return (
      <SitePage narrow>
        <header className="mk-site-intro">
          <h1>Deze link werkt niet.</h1>
          <p>Gebruik de link uit je aanmeldmail, of mail <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a> voor een nieuwe.</p>
        </header>
      </SitePage>
    );
  }
  // Rekening en uitbetalingen (migratie 072). Lukt dat niet, dan blijft de rest van het dashboard staan.
  const affiliate = await affiliateByToken(token).catch(() => null);
  const payouts = affiliate ? await affiliatePayoutOverview(affiliate.id).catch(() => null) : null;
  const day = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
  const nextRate = affiliateRate(data.payingCustomers + 1);
  const toTier = Math.max(0, AFFILIATE.tiers[1].fromCustomer - 1 - data.payingCustomers);
  return (
    <SitePage>
      <header className="mk-site-intro">
        <div className="af-hero-label"><div className="mk-eyebrow"><span />AFFILIATEDASHBOARD</div><span className="af-beta">Beta</span></div>
        <h1>Hoi {data.name.split(" ")[0]}.</h1>
        <p>Je link: <code className="af-inline-code">{`${SITE_ORIGIN.replace("https://www.", "")}/r/${data.username}`}</code></p>
      </header>
      <section className="af-dash">
        <article><span>Aanmeldingen</span><strong>{data.signups}</strong></article>
        <article><span>Betalende klanten</span><strong>{data.payingCustomers}</strong></article>
        <article><span>Geschat per maand</span><strong>{formatEuro(data.estimatedMonthlyCents)}</strong></article>
        <article><span>Je volgende klant</span><strong>{Math.round(nextRate * 100)}%</strong><small>{toTier ? `Nog ${toTier} tot 10%` : "Je zit in het 10%-niveau"}</small></article>
        <article><span>In wachttijd</span><strong>{formatEuro(data.pendingCents)}</strong><small>{AFFILIATE.holdDays} dagen na betaling</small></article>
        <article><span>Uitbetaalbaar</span><strong>{formatEuro(data.availableCents)}</strong><small>Maandelijks vanaf {formatEuro(AFFILIATE.minPayoutCents)}</small></article>
        <article><span>Uitbetaald</span><strong>{formatEuro(data.paidCents)}</strong></article>
      </section>
      {payouts?.ready ? (
        <>
          <section className="af-panel">
            <h2>Uitbetaling</h2>
            <p className="af-panel-text">
              {payouts.account
                ? `We betalen één keer per maand uit op deze rekening, zodra je minstens ${formatEuro(AFFILIATE.minPayoutCents)} uitbetaalbaar hebt staan.`
                : `Vul de rekening in waarop we je commissie overmaken. Zonder rekening kunnen we niet uitbetalen. We betalen één keer per maand uit, vanaf ${formatEuro(AFFILIATE.minPayoutCents)}.`}
            </p>
            <PayoutAccountForm token={token} initial={payouts.account ? { accountHolder: payouts.account.accountHolder, ibanMasked: payouts.account.ibanMasked } : null} />
          </section>
          <section className="af-panel">
            <h2>Uitbetalingen</h2>
            {payouts.payouts.length ? (
              <ul className="af-payouts">
                {payouts.payouts.map((payout) => (
                  <li key={payout.id}>
                    <span>{day(payout.paidAt)}</span>
                    <strong>{formatEuro(payout.totalCents)}</strong>
                    <small>{payout.vatCents ? `${formatEuro(payout.amountCents)} + ${formatEuro(payout.vatCents)} btw` : "geen btw"}</small>
                    <a href={`/affiliate/dashboard/${token}/factuur/${payout.id}`}>Factuur {payout.invoiceNumber}</a>
                  </li>
                ))}
              </ul>
            ) : <p className="af-panel-text">Nog geen uitbetalingen. Zodra we iets overmaken, staat het hier met de factuur erbij.</p>}
          </section>
        </>
      ) : null}
      <p className="af-board-note">Vragen over je uitbetaling of factuur? Mail <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a>.</p>
    </SitePage>
  );
}
