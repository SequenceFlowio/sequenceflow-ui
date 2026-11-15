import type { ReactNode } from "react";

import type { Ga4Report, MetaReport, Requirement } from "@/lib/backoffice/integrations";
import { pct, type Customer, type CustomerStatus, type Dashboard, type SourceRow, type TimelineEvent } from "@/lib/backoffice/metrics";
import { planDisplayName } from "@/lib/planCatalog";
import { AFFILIATE, REFERRAL } from "@/lib/referrals/program";
import { appUrl } from "@/lib/site";

import { BarChart } from "./BarChart";

/* Kleuren van de reeksen: vaste volgorde, gekozen voor de donkere ondergrond. */
const BLUE = "#3987e5";
const ORANGE = "#d95926";
const AQUA = "#199e70";

const TZ = "Europe/Amsterdam";
export const eur = (cents: number, digits = 0) => `€${(cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const num = (value: number) => value.toLocaleString("nl-NL");
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "—");
const dayShort = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: TZ });
const monthLabel = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString("nl-NL", { month: "short" }).replace(".", "");
const monthFull = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
const percent = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("nl-NL")}%`);

const STATUS: Record<CustomerStatus, { label: string; tone: string }> = {
  trial: { label: "Proef", tone: "info" },
  paying: { label: "Betalend", tone: "good" },
  free: { label: "Gratis (intern)", tone: "muted" },
  trial_expired: { label: "Proef verlopen", tone: "muted" },
  canceled: { label: "Opgezegd", tone: "bad" },
};

const EVENT: Record<TimelineEvent["kind"], { label: string; tone: string }> = {
  signup: { label: "Aangemeld", tone: "info" },
  paid: { label: "Betaald", tone: "good" },
  cancel_scheduled: { label: "Zegt op", tone: "warn" },
  canceled: { label: "Opgezegd", tone: "bad" },
  trial_expired: { label: "Proef verlopen", tone: "muted" },
  shopify_uninstalled: { label: "Shopify weg", tone: "bad" },
};

/* ---------- Bouwstenen ---------- */

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="bo-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small className={tone ? `is-${tone}` : undefined}>{sub}</small> : null}
    </div>
  );
}

function Card({ title, note, children, wide }: { title: string; note?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`bo-card${wide ? " bo-card--wide" : ""}`}>
      <h2>{title}</h2>
      {note ? <p className="bo-note">{note}</p> : null}
      {children}
    </section>
  );
}

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`bo-pill is-${tone}`}>{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="bo-empty">{children}</p>;
}

function Table({ head, rows, empty, numeric = [] }: { head: string[]; rows: ReactNode[][]; empty: string; numeric?: number[] }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <thead><tr>{head.map((cell, index) => <th key={cell} className={numeric.includes(index) ? "is-num" : undefined}>{cell}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className={numeric.includes(cellIndex) ? "is-num" : undefined}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <Empty>Nog geen gebeurtenissen.</Empty>;
  return (
    <ol className="bo-timeline">
      {events.map((event, index) => (
        <li key={index}>
          <time>{dayShort(event.at)}</time>
          <Pill tone={EVENT[event.kind].tone}>{EVENT[event.kind].label}</Pill>
          <span><b>{event.customer}</b> {event.detail}</span>
        </li>
      ))}
    </ol>
  );
}

function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="bo-funnel">
      {steps.map((step, index) => (
        <li key={step.label}>
          <span>{step.label}</span>
          <div><i style={{ width: `${Math.max(1, (step.value / top) * 100)}%` }} /></div>
          <b>{num(step.value)}</b>
          <em>{index === 0 ? "" : percent(pct(step.value, top))}</em>
        </li>
      ))}
    </ol>
  );
}

function delta(current: number, previous: number) {
  if (!previous) return current ? "geen vergelijking: vorige periode 0" : "gelijk aan de vorige 30 dagen";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}% t.o.v. de 30 dagen ervoor`;
}

/* ---------- Overzicht ---------- */

export function OverviewTab({ data }: { data: Dashboard }) {
  const o = data.overview;
  const now = data.now;
  const upcoming = data.timeline.filter((event) => event.at <= now).slice(0, 8);
  return (
    <>
      <div className="bo-kpis">
        <Kpi label="Maandomzet (MRR)" value={eur(o.mrrCents)} sub={`${o.paying} betalend · ${eur(o.arpaCents)} per klant`} />
        <Kpi label="Lopende proeven" value={num(o.trials)} sub={o.trialsEndingSoon.length ? `${o.trialsEndingSoon.length} lopen binnen 3 dagen af` : "geen die deze week afloopt"} />
        <Kpi label="Aanmeldingen in 30 dagen" value={num(o.signups30)} sub={delta(o.signups30, o.signupsPrev30)} tone={o.signups30 > o.signupsPrev30 ? "good" : o.signups30 < o.signupsPrev30 ? "bad" : undefined} />
        <Kpi label="Van proef naar betalend" value={percent(o.conversion90Pct)} sub={`${o.conversion90Base} afgelopen proeven in 90 dagen`} />
        <Kpi label="Nieuwe betalende klanten" value={num(o.newPaid30)} sub="in 30 dagen" />
        <Kpi label="Opgezegd in 30 dagen" value={num(o.canceled30)} sub={o.churnPct === null ? "nog geen betalende klanten" : `${percent(o.churnPct)} van de betalende klanten`} tone={o.canceled30 ? "bad" : undefined} />
      </div>

      <div className="bo-grid">
        <Card title="Wat valt op" note="Automatisch afgeleid uit de cijfers hieronder; bovenaan wat het eerst aandacht vraagt.">
          {data.insights.length ? (
            <ul className="bo-insights">
              {data.insights.map((insight, index) => <li key={index} className={`is-${insight.tone}`}><i aria-hidden="true" />{insight.text}</li>)}
            </ul>
          ) : <Empty>Niets bijzonders op dit moment.</Empty>}
        </Card>
        <Card title="Van aanmelding naar betalend" note="Alle werkruimtes. Het percentage is het deel van alle aanmeldingen.">
          <Funnel steps={o.funnel} />
        </Card>
      </div>

      <Card title="Aanmeldingen, nieuwe betalers en opzeggingen per maand" wide>
        <BarChart
          label="Aanmeldingen, nieuwe betalende klanten en opzeggingen per maand, laatste 12 maanden"
          points={o.series.map((point) => ({ label: monthLabel(point.month), full: monthFull(point.month), values: [point.signups, point.paid, point.canceled] }))}
          series={[{ name: "Aangemeld (proef)", color: BLUE }, { name: "Betalend geworden", color: AQUA }, { name: "Opgezegd", color: ORANGE }]}
        />
      </Card>

      <div className="bo-grid">
        <Card title="Proeven die bijna aflopen" note="Binnen drie dagen. Mailbox gekoppeld en concepten laten zien of de klant het product echt heeft geprobeerd.">
          <Table
            head={["Werkruimte", "Loopt af", "Mailbox", "Concepten"]}
            numeric={[3]}
            empty="Geen proeven die binnen drie dagen aflopen."
            rows={o.trialsEndingSoon.map((customer) => [<Who key="w" customer={customer} />, day(customer.trialEndsAt), customer.connected ? "gekoppeld" : <Pill key="p" tone="warn">niet gekoppeld</Pill>, num(customer.drafts30)])}
          />
        </Card>
        <Card title="Laatste gebeurtenissen">
          <Timeline events={upcoming} />
        </Card>
      </div>
    </>
  );
}

function Who({ customer }: { customer: Customer }) {
  return <span className="bo-who"><b>{customer.name}</b>{customer.email ? <small>{customer.email}</small> : null}</span>;
}

/* ---------- Klanten: aan- en afmeldingen per app ---------- */

const FILTERS: Array<{ key: string; label: string; match: (customer: Customer) => boolean }> = [
  { key: "alle", label: "Alle", match: () => true },
  { key: "proef", label: "Proef", match: (customer) => customer.status === "trial" },
  { key: "betalend", label: "Betalend", match: (customer) => customer.status === "paying" },
  { key: "opgezegd", label: "Opgezegd", match: (customer) => customer.status === "canceled" },
  { key: "verlopen", label: "Proef verlopen", match: (customer) => customer.status === "trial_expired" },
  { key: "intern", label: "Gratis (intern)", match: (customer) => customer.status === "free" },
];

export function CustomersTab({ data, filter }: { data: Dashboard; filter: string }) {
  const o = data.overview;
  const active = FILTERS.find((item) => item.key === filter) ?? FILTERS[0];
  const rows = data.customers.filter(active.match).sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt));
  const past = data.timeline.filter((event) => event.at <= data.now).slice(0, 40);
  return (
    <>
      <div className="bo-apps" role="group" aria-label="App">
        <span className="is-active">Support One <b>{num(o.total)}</b></span>
        <span className="is-soon">Volgende app verschijnt hier vanzelf</span>
      </div>
      <div className="bo-kpis">
        <Kpi label="Aangemeld (totaal)" value={num(o.total)} sub={`${o.signups7} deze week · ${o.signups30} in 30 dagen`} />
        <Kpi label="In proef (14 dagen)" value={num(o.trials)} />
        <Kpi label="Betalend" value={num(o.paying)} sub={`${o.newPaid30} nieuw in 30 dagen`} />
        <Kpi label="Opgezegd in 30 dagen" value={num(o.canceled30)} sub={o.cancelScheduled.length ? `${o.cancelScheduled.length} hebben opgezegd en lopen nog af` : undefined} />
        <Kpi label="Van proef naar betalend" value={percent(o.conversionPct)} sub={`alle ${o.conversionBase} afgelopen proeven`} />
        <Kpi label="Dagen tot betaling" value={o.medianDaysToPay === null ? "—" : num(Math.round(o.medianDaysToPay))} sub="mediaan, vanaf aanmelding" />
      </div>

      <Card title="Werkruimtes" wide note="Elke aanmelding start een proef van 14 dagen. Betaald sinds = de dag van het eerste betaalde abonnement.">
        <nav className="bo-filters" aria-label="Filter op status">
          {FILTERS.map((item) => (
            <a key={item.key} href={`?tab=klanten${item.key === "alle" ? "" : `&status=${item.key}`}`} className={item.key === active.key ? "is-active" : undefined} aria-current={item.key === active.key ? "true" : undefined}>
              {item.label} <b>{data.customers.filter(item.match).length}</b>
            </a>
          ))}
        </nav>
        <Table
          head={["Werkruimte", "Status", "Pakket", "Aangemeld", "Proef tot", "Betaald sinds", "Opgezegd", "Per maand", "Via", "Herkomst", "Gebruik"]}
          numeric={[7]}
          empty="Geen werkruimtes met deze status."
          rows={rows.map((customer) => [
            <Who key="w" customer={customer} />,
            <Pill key="s" tone={STATUS[customer.status].tone}>{STATUS[customer.status].label}</Pill>,
            planDisplayName(customer.plan),
            day(customer.signedUpAt),
            day(customer.trialEndsAt),
            customer.paidSince ? `${day(customer.paidSince)}${customer.daysToPay === null ? "" : ` (na ${customer.daysToPay} d)`}` : "—",
            customer.canceledAt ? <span key="c" title={customer.cancelReason ?? undefined}>{day(customer.canceledAt)}{customer.cancelReason ? <small className="bo-sub">{customer.cancelReason}</small> : null}</span>
              : customer.cancelScheduledFor ? <Pill key="c" tone="warn">per {dayShort(customer.cancelScheduledFor)}</Pill> : "—",
            customer.mrrCents ? `${eur(customer.mrrCents)}${customer.mrrEstimated ? " *" : ""}` : "—",
            customer.channel === "stripe" ? "Stripe" : customer.channel === "shopify" ? "Shopify" : "—",
            customer.source,
            <span key="u" className="bo-sub-inline">{customer.connected ? "mailbox ✓" : "geen mailbox"} · {num(customer.drafts30)} concepten</span>,
          ])}
        />
        <p className="bo-foot">* geschat op de pakketprijs (Shopify rekent zelf af, of Stripe gaf geen vast bedrag door).</p>
      </Card>

      <div className="bo-grid">
        <Card title="Per aanmeldweek" note="Hoeveel van elke week betalend werd. Het percentage telt alleen proeven die al zijn afgelopen.">
          <Table
            head={["Week van", "Aangemeld", "Betalend", "Nog in proef", "Afgehaakt", "Omzetting"]}
            numeric={[1, 2, 3, 4, 5]}
            empty="Nog geen aanmeldingen."
            rows={[...o.cohorts].reverse().map((cohort) => [dayShort(cohort.week), num(cohort.signups), num(cohort.paying), num(cohort.trial), num(cohort.lost), percent(cohort.ratePct)])}
          />
        </Card>
        <Card title="Aan- en afmeldingen" note="De laatste veertig gebeurtenissen, nieuwste boven.">
          <Timeline events={past} />
        </Card>
      </div>
    </>
  );
}

/* ---------- Omzet ---------- */

export function RevenueTab({ data }: { data: Dashboard }) {
  const o = data.overview;
  const top = [...data.customers].filter((customer) => customer.paidTotalCents > 0 || customer.mrrCents > 0).sort((a, b) => b.paidTotalCents - a.paidTotalCents || b.mrrCents - a.mrrCents).slice(0, 15);
  return (
    <>
      <div className="bo-kpis">
        <Kpi label="Maandomzet (MRR)" value={eur(o.mrrCents)} sub={o.estimatedMrrCents ? `waarvan ${eur(o.estimatedMrrCents)} geschat` : "vaste abonnementen, zonder verbruik"} />
        <Kpi label="Jaaromzet bij dit tempo (ARR)" value={eur(o.arrCents)} />
        <Kpi label="Ontvangen deze maand" value={eur(o.revenueThisMonthCents)} sub={`vorige maand ${eur(o.revenueLastMonthCents)}`} />
        <Kpi label="Ontvangen in 12 maanden" value={eur(o.revenue12Cents)} sub={o.refunds12Cents ? `${eur(o.refunds12Cents)} terugbetaald` : "geen terugbetalingen"} />
        <Kpi label="Per klant per maand" value={eur(o.arpaCents)} sub={`${o.paying} betalende klanten`} />
        <Kpi label="Waarde per klant (LTV)" value={o.ltvCents === null ? "—" : eur(o.ltvCents)} sub={o.ltvCents === null ? "pas te berekenen als er klanten opzeggen" : `bij ${percent(o.churnPct)} uitval per maand`} />
      </div>

      {!data.stripeAvailable ? <p className="bo-banner">Stripe-gegevens ontbreken, dus ontvangen omzet en opzegdata staan op nul. De maandomzet is geschat op pakketprijzen.</p> : null}

      <Card title="Ontvangen omzet per maand" wide note="Betaalde Stripe-facturen, exclusief btw: abonnement plus verbruik per gesprek. Omzet via Shopify staat hier niet in.">
        <BarChart
          unit="eur"
          label="Ontvangen omzet per maand, laatste 12 maanden"
          points={o.series.map((point) => ({ label: monthLabel(point.month), full: monthFull(point.month), values: [point.revenueCents] }))}
          series={[{ name: "Ontvangen", color: BLUE }]}
        />
      </Card>

      <div className="bo-grid">
        <Card title="Maandomzet per pakket">
          <Table
            head={["Pakket", "Klanten", "Per maand", "Aandeel"]}
            numeric={[1, 2, 3]}
            empty="Nog geen betalende klanten."
            rows={o.planMix.map((row) => [planDisplayName(row.plan), num(row.count), eur(row.mrrCents), percent(pct(row.mrrCents, o.mrrCents))])}
          />
          {o.openInvoices ? <p className="bo-foot">{o.openInvoices} {o.openInvoices === 1 ? "factuur" : "facturen"} ({eur(o.openInvoicesCents)}) nog niet geïncasseerd.</p> : null}
        </Card>
        <Card title="Per maand in cijfers">
          <Table
            head={["Maand", "Ontvangen", "Terugbetaald", "Nieuw betalend", "Opgezegd"]}
            numeric={[1, 2, 3, 4]}
            empty="Nog geen omzet."
            rows={[...o.series].reverse().slice(0, 6).map((point) => [monthFull(point.month), eur(point.revenueCents), point.refundCents ? eur(point.refundCents) : "—", num(point.paid), num(point.canceled)])}
          />
        </Card>
      </div>

      <Card title="Klanten naar omzet" wide note="Totaal ontvangen in de laatste 13 maanden.">
        <Table
          head={["Werkruimte", "Status", "Pakket", "Betaald sinds", "Per maand", "Totaal ontvangen"]}
          numeric={[4, 5]}
          empty="Nog geen betalende klanten."
          rows={top.map((customer) => [<Who key="w" customer={customer} />, <Pill key="s" tone={STATUS[customer.status].tone}>{STATUS[customer.status].label}</Pill>, planDisplayName(customer.plan), day(customer.paidSince), customer.mrrCents ? eur(customer.mrrCents) : "—", eur(customer.paidTotalCents)])}
        />
        <p className="bo-foot">Kosten en marge per klant (AI, Stripe, vaste lasten) staan in het bestaande <a href={appUrl("/intern")}>interne kostenoverzicht</a> in de app.</p>
      </Card>
    </>
  );
}

/* ---------- Doorverwijzingen en affiliates ---------- */

export function PartnersTab({ data }: { data: Dashboard }) {
  const r = data.referrals;
  return (
    <>
      <div className="bo-kpis">
        <Kpi label="Aanmeldingen via partners" value={num(r.viaAffiliate + r.viaReferral)} sub={`${r.viaAffiliate} via affiliates · ${r.viaReferral} via klanten · ${percent(r.sharePct)} van alles`} />
        <Kpi label="Maandomzet via partners" value={eur(r.partnerMrrCents)} sub={`${percent(pct(r.partnerMrrCents, data.overview.mrrCents))} van de maandomzet`} />
        <Kpi label="Kliks op partnerlinks" value={num(r.clicksTotal)} sub="laatste 120 dagen, sequenceflow.io/r/…" />
        <Kpi label="Actieve affiliates" value={num(r.activeAffiliates)} sub={`${r.newAffiliates30} nieuw in 30 dagen${r.silentAffiliates ? ` · ${r.silentAffiliates} zonder klik` : ""}`} />
        <Kpi label="Commissie nu uit te betalen" value={eur(r.commissionAvailableCents, 2)} sub={`${eur(r.commissionPendingCents, 2)} in wachttijd · ${eur(r.commissionPaidCents, 2)} betaald`} />
        <Kpi label="Tegoed voor doorverwijzers" value={eur(r.creditOpenCents, 2)} sub={`open · ${eur(r.creditPaidCents, 2)} al verrekend`} />
      </div>

      <div className="bo-grid">
        <Card title="Uitbetalen" note={`Affiliates met minstens ${eur(AFFILIATE.minPayoutCents)} vrijgegeven commissie (${AFFILIATE.holdDays} dagen na de betaling van de klant).`}>
          <Table
            head={["Affiliate", "E-mail", "Uit te betalen"]}
            numeric={[2]}
            empty="Niemand hoeft nu uitbetaald te worden."
            rows={r.payoutsDue.map((affiliate) => [affiliate.username, affiliate.email, eur(affiliate.availableCents, 2)])}
          />
        </Card>
        <Card title="Leveren partners betere klanten?" note="Deel van de afgelopen proeven dat betalend werd, per herkomst.">
          <Table
            head={["Herkomst", "Aanmeldingen", "Omzetting"]}
            numeric={[1, 2]}
            empty=""
            rows={[
              ["Via een affiliate", num(r.viaAffiliate), percent(r.conversion.affiliate)],
              ["Doorverwezen door een klant", num(r.viaReferral), percent(r.conversion.referral)],
              ["Alle andere aanmeldingen", num(data.customers.filter((customer) => customer.sourceKind !== "affiliate" && customer.sourceKind !== "referral" && customer.status !== "free").length), percent(r.conversion.other)],
            ]}
          />
        </Card>
      </div>

      <Card title="Affiliates" wide note={`Commissie: ${AFFILIATE.tiers.map((tier) => `${Math.round(tier.rate * 100)}% vanaf klant ${tier.fromCustomer}`).join(", ")}. Gesorteerd op de maandomzet die ze binnenbrachten.`}>
        <Table
          head={["Affiliate", "Kanaal", "Sinds", "Kliks", "Aanmeldingen", "Betalend", "Klik → aanmelding", "Maandomzet", "In wachttijd", "Uit te betalen", "Betaald"]}
          numeric={[3, 4, 5, 6, 7, 8, 9, 10]}
          empty="Nog geen affiliates. Aanmelden kan op sequenceflow.io/affiliate."
          rows={r.affiliates.map((affiliate) => [
            <span key="a" className="bo-who"><b>{affiliate.username}</b><small>{affiliate.name} · {affiliate.email}</small></span>,
            affiliate.channel ?? "—",
            day(affiliate.createdAt),
            num(affiliate.clicks), num(affiliate.signups), num(affiliate.paying),
            percent(pct(affiliate.signups, affiliate.clicks)),
            eur(affiliate.mrrCents), eur(affiliate.pendingCents, 2), eur(affiliate.availableCents, 2), eur(affiliate.paidCents, 2),
          ])}
        />
      </Card>

      <div className="bo-grid">
        <Card title="Klanten die doorverwijzen" note={`Per nieuwe betalende klant ${Math.round(REFERRAL.referrerRate * 100)}% van het eigen maandbedrag als tegoed, maximaal ${REFERRAL.maxRewards} keer.`}>
          <Table
            head={["Klant", "Kliks", "Aanmeldingen", "Betalend", "Tegoed open", "Verrekend"]}
            numeric={[1, 2, 3, 4, 5]}
            empty="Nog geen klant heeft iemand doorverwezen."
            rows={r.referrers.map((row) => [<span key="n" className="bo-who"><b>{row.name}</b><small>{row.code ?? ""}</small></span>, num(row.clicks), num(row.signups), num(row.paying), eur(row.pendingCents, 2), eur(row.paidCents, 2)])}
          />
        </Card>
        <Card title="Laatste beloningen" note="Elke betaalde factuur van een aangebrachte klant geeft één regel.">
          <Table
            head={["Datum", "Voor", "Klant", "Bedrag", "Status"]}
            numeric={[3]}
            empty="Nog geen beloningen."
            rows={r.rewards.slice(0, 12).map((reward) => [
              dayShort(reward.at), `${reward.who}${reward.kind === "referrer_credit" ? " (tegoed)" : ""}`, reward.customer, eur(reward.amountCents, 2),
              <Pill key="s" tone={reward.status === "paid" ? "good" : reward.status === "available" ? "info" : reward.status === "reversed" ? "bad" : "muted"}>
                {reward.status === "paid" ? "Betaald" : reward.status === "available" ? "Vrijgegeven" : reward.status === "reversed" ? "Vervallen" : `Wacht tot ${dayShort(reward.availableAt)}`}
              </Pill>,
            ])}
          />
        </Card>
      </div>
    </>
  );
}

/* ---------- Marketing: eigen meting, GA4, Meta ---------- */

function SourceTable({ rows, first, empty }: { rows: SourceRow[]; first: string; empty: string }) {
  return (
    <Table
      head={[first, "Bezoeken", "Klikt op knop", "Aanmeldingen", "Bezoek → aanmelding", "Betalend", "Maandomzet"]}
      numeric={[1, 2, 3, 4, 5, 6]}
      empty={empty}
      rows={rows.slice(0, 12).map((row) => [row.key, num(row.sessions), percent(pct(row.cta, row.sessions)), num(row.signups), percent(pct(row.signups, row.sessions)), num(row.paying), row.mrrCents ? eur(row.mrrCents) : "—"])}
    />
  );
}

function Setup({ name, requirements, children }: { name: string; requirements: Requirement[]; children?: ReactNode }) {
  const done = requirements.filter((item) => item.set).length;
  return (
    <div className="bo-setup">
      <p><Pill tone={done === requirements.length ? "good" : done ? "warn" : "muted"}>{done === requirements.length ? "Gekoppeld" : done ? "Deels gekoppeld" : "Nog niet gekoppeld"}</Pill> {name}: {done} van {requirements.length} instellingen zijn klaar.</p>
      <ul>
        {requirements.map((item) => <li key={item.env} className={item.set ? "is-set" : undefined}><code>{item.env}</code><span>{item.label}</span></li>)}
      </ul>
      {children}
    </div>
  );
}

export function MarketingTab({ data, ga4, meta }: {
  data: Dashboard;
  ga4: { report: Ga4Report | null; error: string | null; requirements: Requirement[] };
  meta: { report: MetaReport | null; error: string | null; requirements: Requirement[] };
}) {
  const m = data.marketing;
  const metaPaying = m.bySource.filter((row) => row.key === "meta" || row.key === "meta ads" || row.key === "facebook" || row.key === "instagram").reduce((sum, row) => sum + row.paying, 0);
  const metaSignups = m.bySource.filter((row) => row.key === "meta" || row.key === "meta ads" || row.key === "facebook" || row.key === "instagram").reduce((sum, row) => sum + row.signups, 0);
  return (
    <>
      <div className="bo-kpis">
        <Kpi label="Bezoeken in 30 dagen" value={num(m.sessions)} sub="eigen meting, zonder cookies van derden" />
        <Kpi label="Klikt op een knop" value={percent(pct(m.ctaSessions, m.sessions))} sub={`${num(m.ctaSessions)} bezoeken`} />
        <Kpi label="Aanmeldingen" value={num(m.signups)} sub={`${percent(pct(m.signups, m.sessions))} van de bezoeken`} />
        <Kpi label="Daarvan nu betalend" value={num(m.paying)} sub={`${percent(pct(m.paying, m.signups))} van de aanmeldingen`} />
        <Kpi label="Kliks uit Google Ads" value={num(m.googleAdClicks)} sub="bezoeken met gclid" />
        <Kpi label="Kliks uit Meta-advertenties" value={num(m.metaAdClicks)} sub="bezoeken met fbclid" />
      </div>

      <Card title="Bezoeken per dag" wide note="Eén bezoek = één browsersessie op een pagina van de website. Aanmeldingen staan ernaast op dezelfde as.">
        <BarChart
          label="Bezoeken en aanmeldingen per dag, laatste 30 dagen"
          every={5}
          points={m.daily.map((point) => ({ label: dayShort(point.day), full: day(point.day), values: [point.sessions, point.signups] }))}
          series={[{ name: "Bezoeken", color: BLUE }, { name: "Aanmeldingen", color: AQUA }]}
        />
      </Card>

      <Card title="Waar komen bezoekers vandaan" wide note="Bron = utm_source in de link, anders een advertentieklik, anders de site waar iemand vandaan kwam. Maandomzet = wat die aanmeldingen nu per maand betalen.">
        <SourceTable rows={m.bySource} first="Bron" empty="Nog geen bezoeken gemeten in deze periode." />
      </Card>

      <div className="bo-grid">
        <Card title="Campagnes" note="Alleen bezoeken met utm_campaign in de link.">
          <SourceTable rows={m.byCampaign} first="Campagne" empty="Nog geen bezoeken met een campagnenaam. Zet utm_campaign in elke advertentielink." />
        </Card>
        <Card title="Pagina waar iemand binnenkomt">
          <SourceTable rows={m.byLanding} first="Pagina" empty="Nog geen bezoeken gemeten." />
        </Card>
      </div>

      <div className="bo-grid">
        <Card title="Knoppen waar op geklikt wordt">
          <Table head={["Knop", "Kliks"]} numeric={[1]} empty="Nog geen kliks gemeten." rows={m.ctaLabels.map((row) => [row.label, num(row.count)])} />
        </Card>
        <Card title="Trechter van de website" note="Het percentage is het deel van alle bezoeken.">
          <Funnel steps={[{ label: "Bezoeken", value: m.sessions }, { label: "Klikt op een knop", value: m.ctaSessions }, { label: "Meldt zich aan", value: m.signups }, { label: "Betaalt", value: m.paying }]} />
        </Card>
      </div>

      <Card title="Google Analytics 4" wide>
        {ga4.report ? (
          <>
            <div className="bo-kpis bo-kpis--inner">
              <Kpi label="Gebruikers (28 dagen)" value={num(ga4.report.users)} />
              <Kpi label="Sessies" value={num(ga4.report.sessions)} />
              <Kpi label="Paginaweergaven" value={num(ga4.report.pageViews)} />
              <Kpi label="Betrokken sessies" value={percent(ga4.report.engagementPct)} />
              <Kpi label="Belangrijke gebeurtenissen" value={num(ga4.report.keyEvents)} />
            </div>
            <BarChart label="Sessies per dag volgens Google Analytics" every={5} points={ga4.report.daily.map((point) => ({ label: dayShort(point.day), full: day(point.day), values: [point.sessions] }))} series={[{ name: "Sessies", color: BLUE }]} height={140} />
            <div className="bo-grid bo-grid--inner">
              <Table head={["Kanaal", "Sessies", "Gebruikers", "Gebeurtenissen"]} numeric={[1, 2, 3]} empty="Geen kanalen." rows={ga4.report.channels.map((row) => [row.name, num(row.sessions), num(row.users), num(row.keyEvents)])} />
              <Table head={["Pagina", "Weergaven", "Gebruikers"]} numeric={[1, 2]} empty="Geen pagina's." rows={ga4.report.pages.map((row) => [row.path, num(row.views), num(row.users)])} />
            </div>
          </>
        ) : (
          <Setup name="Google Analytics 4" requirements={ga4.requirements}>
            {ga4.error ? <p className="bo-banner">Google gaf een fout: {ga4.error}</p> : null}
            <p className="bo-note">De Tag Manager-container staat op de website en laadt nadat een bezoeker toestemming geeft. Zet in die container een GA4-tag, en zet het property-id en de sleutel in Vercel: dan verschijnen hier gebruikers, sessies, kanalen en de best bezochte pagina&apos;s. Tot die tijd laat de eigen meting hierboven dezelfde vragen zien.</p>
          </Setup>
        )}
      </Card>

      <Card title="Meta: pixel en advertenties" wide>
        {meta.report && (meta.report.ads || meta.report.pixelEvents) ? (
          <>
            {meta.report.ads ? (
              <div className="bo-kpis bo-kpis--inner">
                <Kpi label="Uitgegeven (30 dagen)" value={eur(meta.report.ads.spendCents)} />
                <Kpi label="Vertoningen" value={num(meta.report.ads.impressions)} />
                <Kpi label="Kliks" value={num(meta.report.ads.clicks)} sub={`${percent(meta.report.ads.ctrPct)} doorklik · ${eur(meta.report.ads.cpcCents, 2)} per klik`} />
                <Kpi label="Kosten per aanmelding" value={metaSignups ? eur(Math.round(meta.report.ads.spendCents / metaSignups)) : "—"} sub={`${metaSignups} aanmeldingen via Meta (eigen meting)`} />
                <Kpi label="Kosten per betalende klant" value={metaPaying ? eur(Math.round(meta.report.ads.spendCents / metaPaying)) : "—"} sub={`${metaPaying} betalend via Meta`} />
              </div>
            ) : null}
            {meta.error ? <p className="bo-banner">Meta gaf een fout: {meta.error}</p> : null}
            <div className="bo-grid bo-grid--inner">
              <Table head={["Campagne", "Uitgegeven", "Kliks", "Vertoningen"]} numeric={[1, 2, 3]} empty="Geen campagnes met uitgaven in deze periode." rows={meta.report.campaigns.map((row) => [row.name, eur(row.spendCents), num(row.clicks), num(row.impressions)])} />
              <Table head={["Pixelgebeurtenis", "Aantal"]} numeric={[1]} empty="De pixel heeft in deze periode niets ontvangen." rows={(meta.report.pixelEvents ?? []).map((row) => [row.name, num(row.count)])} />
            </div>
          </>
        ) : (
          <Setup name="Meta" requirements={meta.requirements}>
            {meta.error ? <p className="bo-banner">Meta gaf een fout: {meta.error}</p> : null}
            <p className="bo-note">Met het pixel-id komt de pixel op de website (na toestemming van de bezoeker). Met het token en het advertentieaccount rekent dit blok uit wat een aanmelding en een betalende klant kosten. Tot die tijd: {num(m.metaAdClicks)} bezoeken met een Meta-advertentieklik in 30 dagen, {num(metaSignups)} aanmeldingen.</p>
          </Setup>
        )}
      </Card>
    </>
  );
}

/* ---------- Koppelingen ---------- */

export function SettingsTab({ ga4, meta, adminCount, email, stripe }: { ga4: Requirement[]; meta: Requirement[]; adminCount: number; email: string; stripe: boolean }) {
  return (
    <div className="bo-grid">
      <Card title="Toegang">
        <ul className="bo-facts">
          <li><span>Ingelogd als</span><b>{email}</b></li>
          <li><span>Beheerders</span><b>{adminCount} {adminCount === 1 ? "adres" : "adressen"} in PLATFORM_ADMIN_EMAILS</b></li>
          <li><span>Inloggen</span><b>eenmalige code per mail + authenticator-app</b></li>
          <li><span>Opnieuw bevestigen</span><b>elke 12 uur</b></li>
          <li><span>Zoekmachines</span><b>uitgesloten (noindex en robots.txt)</b></li>
        </ul>
        <p className="bo-note">Een beheerder toevoegen of weghalen: pas PLATFORM_ADMIN_EMAILS aan in Vercel (komma tussen adressen) en zet de site opnieuw live. Het adres moet een bestaand SequenceFlow-account zijn.</p>
      </Card>
      <Card title="Databronnen">
        <ul className="bo-facts">
          <li><span>Werkruimtes, proeven, herkomst</span><b>Supabase · gekoppeld</b></li>
          <li><span>Omzet, betaaldata, opzeggingen</span><b>{stripe ? "Stripe · gekoppeld" : "Stripe · niet bereikbaar"}</b></li>
          <li><span>Bezoek en campagnes</span><b>eigen meting · gekoppeld</b></li>
          <li><span>Kliks op partnerlinks</span><b>eigen meting · vanaf deze versie</b></li>
        </ul>
        <p className="bo-note">Cijfers worden twee minuten bewaard. De knop Verversen bovenaan haalt alles direct opnieuw op.</p>
      </Card>
      <Card title="Google Analytics 4"><Setup name="Google Analytics 4" requirements={ga4} /></Card>
      <Card title="Meta"><Setup name="Meta" requirements={meta} /></Card>
    </div>
  );
}
