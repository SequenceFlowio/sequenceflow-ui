import type { Metadata } from "next";

import { SitePage } from "@/components/marketing/SitePage";
import { AFFILIATE, formatEuro } from "@/lib/referrals/program";
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
  const funnel = data.funnel;
  const pct = (part: number) => (funnel.signups ? Math.round((part / funnel.signups) * 100) : 0);
  return (
    <SitePage>
      <header className="mk-site-intro">
        <div className="af-hero-label"><div className="mk-eyebrow"><span />AFFILIATEDASHBOARD</div><span className="af-beta">Beta</span></div>
        <h1>Hoi {data.name.split(" ")[0]}.</h1>
        <p>Je affiliatelink: <code className="af-inline-code">{`${SITE_ORIGIN.replace("https://www.", "")}/r/${data.username}`}</code></p>
        <p>Je code: <code className="af-inline-code">{data.username}</code> Wie die invult bij het aanmelden of tijdens de proef, krijgt {Math.round(AFFILIATE.newCustomerRate * 100)}% korting op de eerste maand en telt als jouw klant.</p>
      </header>
      <section className="af-dash">
        <article><span>Aanmeldingen</span><strong>{data.signups}</strong></article>
        <article><span>Betalende klanten</span><strong>{data.payingCustomers}</strong></article>
        <article><span>Geschat per maand</span><strong>{formatEuro(data.estimatedMonthlyCents)}</strong></article>
        <article><span>Jouw commissie</span><strong>{Math.round(AFFILIATE.rate * 100)}%</strong><small>van elke betaling, zolang ze klant blijven</small></article>
        <article><span>In wachttijd</span><strong>{formatEuro(data.pendingCents)}</strong><small>{AFFILIATE.holdDays} dagen na betaling</small></article>
        <article><span>Uitbetaalbaar</span><strong>{formatEuro(data.availableCents)}</strong><small>Maandelijks, zonder minimum</small></article>
        <article><span>Uitbetaald</span><strong>{formatEuro(data.paidCents)}</strong></article>
      </section>
      <section className="af-panel">
        <h2>Wat er met je aanmeldingen gebeurde</h2>
        <p className="af-panel-text">Iedereen begint met 14 dagen gratis proberen. Hier zie je hoeveel er daarna gingen betalen en hoeveel afhaakten. Namen tonen we niet.</p>
        {funnel.signups ? (
          <>
            <div className="af-funnel" role="img" aria-label={`${funnel.inTrial} in proef, ${funnel.paying} betalend, ${funnel.canceled} opgezegd, ${funnel.dropped} afgehaakt`}>
              {funnel.paying ? <i className="is-paying" style={{ flexGrow: funnel.paying }} /> : null}
              {funnel.inTrial ? <i className="is-trial" style={{ flexGrow: funnel.inTrial }} /> : null}
              {funnel.canceled ? <i className="is-canceled" style={{ flexGrow: funnel.canceled }} /> : null}
              {funnel.dropped ? <i className="is-dropped" style={{ flexGrow: funnel.dropped }} /> : null}
            </div>
            <ul className="af-funnel-legend">
              <li><i className="is-paying" />Betalend<strong>{funnel.paying}</strong><small>{pct(funnel.paying)}%</small></li>
              <li><i className="is-trial" />Nog in de proef<strong>{funnel.inTrial}</strong><small>{pct(funnel.inTrial)}%</small></li>
              <li><i className="is-canceled" />Betaald, later opgezegd<strong>{funnel.canceled}</strong><small>{pct(funnel.canceled)}%</small></li>
              <li><i className="is-dropped" />Afgehaakt na de proef<strong>{funnel.dropped}</strong><small>{pct(funnel.dropped)}%</small></li>
            </ul>
            <p className="af-panel-text">{funnel.conversionPct === null ? "Nog niemand is klaar met de proef." : `Van wie klaar is met de proef, ging ${funnel.conversionPct}% betalen.`} Haken er veel af? Vertel je publiek wat ze in de proef moeten doen: de supportmailbox koppelen, want pas dan zien ze het werken.</p>
          </>
        ) : <p className="af-panel-text">Nog geen aanmeldingen via jouw link of code.</p>}
      </section>
      {payouts?.ready ? (
        <>
          <section className="af-panel">
            <h2>Uitbetaling</h2>
            <p className="af-panel-text">
              {payouts.account
                ? "We betalen één keer per maand uit op deze rekening, alles wat uitbetaalbaar is, zonder minimumbedrag."
                : "Vul de rekening in waarop we je commissie overmaken. Zonder rekening kunnen we niet uitbetalen. We betalen één keer per maand uit, zonder minimumbedrag."}
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
