import type { Metadata } from "next";

import { adminState } from "@/lib/backoffice/auth";
import { adminEmails } from "@/lib/backoffice/authCore";
import { loadDashboard } from "@/lib/backoffice/data";
import { ga4Requirements, loadGa4, loadMeta, metaRequirements } from "@/lib/backoffice/integrations";

import { LoginFlow, LogoutButton } from "./LoginFlow";
import { CustomersTab, MarketingTab, OverviewTab, PartnersTab, RevenueTab, SettingsTab } from "./sections";
import "./backoffice.css";

export const metadata: Metadata = {
  title: "Beheer · SequenceFlow",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};
export const dynamic = "force-dynamic";

/**
 * Beheerdashboard van SequenceFlow zelf, op sequenceflow.io/backoffice.
 * Aanmeldingen, proeven, omzet, partners en
 * marketing in één scherm. Alleen na inloggen met e-mailcode en authenticator;
 * voor ieder ander is dit een inlogscherm zonder inhoud.
 */

const TABS = [
  { key: "overzicht", label: "Overzicht" },
  { key: "klanten", label: "Aan- en afmeldingen" },
  { key: "omzet", label: "Omzet" },
  { key: "partners", label: "Doorverwijzingen en affiliates" },
  { key: "marketing", label: "Marketing" },
  { key: "koppelingen", label: "Koppelingen" },
] as const;

export default async function BackofficePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = await adminState();
  if (state.state !== "ok") {
    return <LoginFlow initial={state.state === "needs_mfa" ? "mfa" : "email"} knownEmail={state.state === "needs_mfa" ? state.email : undefined} />;
  }

  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const tab = TABS.find((item) => item.key === one(params.tab))?.key ?? "overzicht";
  const needsAds = tab === "marketing";

  const [data, ga4, meta] = await Promise.all([
    loadDashboard({ fresh: one(params.vers) === "1" }),
    needsAds ? loadGa4() : Promise.resolve({ report: null, error: null }),
    needsAds ? loadMeta() : Promise.resolve({ report: null, error: null }),
  ]);
  const updated = new Date(data.now).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });

  return (
    <div className="bo">
      <header className="bo-top">
        <div>
          <p className="bo-eyebrow">Alleen voor SequenceFlow</p>
          <h1>Beheer</h1>
        </div>
        <div className="bo-top-meta">
          <span>Bijgewerkt {updated}</span>
          <a className="bo-link" href={`?tab=${tab}&vers=1`}>Verversen</a>
          <LogoutButton />
        </div>
      </header>

      <nav className="bo-tabs" aria-label="Onderdelen">
        {TABS.map((item) => <a key={item.key} href={`?tab=${item.key}`} className={item.key === tab ? "is-active" : undefined} aria-current={item.key === tab ? "page" : undefined}>{item.label}</a>)}
      </nav>

      {data.notes.map((note) => <p key={note} className="bo-banner">{note}</p>)}

      <main className="bo-main">
        {tab === "overzicht" ? <OverviewTab data={data} /> : null}
        {tab === "klanten" ? <CustomersTab data={data} filter={one(params.status)} /> : null}
        {tab === "omzet" ? <RevenueTab data={data} /> : null}
        {tab === "partners" ? <PartnersTab data={data} /> : null}
        {tab === "marketing" ? <MarketingTab data={data} ga4={{ ...ga4, requirements: ga4Requirements() }} meta={{ ...meta, requirements: metaRequirements() }} /> : null}
        {tab === "koppelingen" ? <SettingsTab ga4={ga4Requirements()} meta={metaRequirements()} adminCount={adminEmails(process.env.PLATFORM_ADMIN_EMAILS).length} email={state.email} stripe={data.stripeAvailable} /> : null}
      </main>
    </div>
  );
}
