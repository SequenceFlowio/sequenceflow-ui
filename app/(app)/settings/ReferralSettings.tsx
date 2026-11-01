"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Gift } from "lucide-react";

import { Notice, Section, SettingsSkeleton } from "./SettingsUi";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { formatEuro } from "@/lib/referrals/program";
import { SITE_ORIGIN } from "@/lib/site";

type Overview = { link: string; signedUp: number; paying: number; maxRewards: number; earnedCents: number; pendingCents: number; referrerCreditCents: number; newCustomerCreditCents: number };

/** Doorverwijzen voor klanten: tegoed op het eigen abonnement, maximaal 5 keer. */
export default function ReferralSettings() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    setFailed(false);
    try {
      const response = await fetch("/api/referrals", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch { setFailed(true); }
  }
  useEffect(() => { void load(); }, []);

  async function copy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.link).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (failed) return <Notice tone="error" title={nl ? "Doorverwijzen kon niet laden" : "Referrals failed to load"}><button className="settings-btn" onClick={() => void load()}>{nl ? "Opnieuw proberen" : "Try again"}</button></Notice>;
  if (!data) return <SettingsSkeleton />;

  const full = data.paying >= data.maxRewards;
  const credit = formatEuro(data.referrerCreditCents);
  const welcome = formatEuro(data.newCustomerCreditCents);
  return <div className="settings-stack">
    <Section icon={<Gift size={18} />} title={nl ? "Verwijs een ondernemer door" : "Refer a store owner"} description={nl ? `Jij krijgt ${credit} tegoed op je abonnement voor elke nieuwe klant die betaalt, tot ${data.maxRewards} keer. Zij krijgen ${welcome} welkomsttegoed.` : `You get ${credit} credit on your plan for every new customer who pays, up to ${data.maxRewards} times. They get ${welcome} welcome credit.`}>
      <div className="settings-referral-link">
        <input readOnly value={data.link} aria-label={nl ? "Jouw doorverwijslink" : "Your referral link"} onFocus={(e) => e.currentTarget.select()} />
        <button className="settings-btn primary" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? (nl ? "Gekopieerd" : "Copied") : (nl ? "Kopieer link" : "Copy link")}</button>
      </div>
      <div className="settings-referral-stats">
        <div><span className="settings-eyebrow">{nl ? "Aangemeld" : "Signed up"}</span><strong>{data.signedUp}</strong></div>
        <div><span className="settings-eyebrow">{nl ? "Betalend" : "Paying"}</span><strong>{data.paying} / {data.maxRewards}</strong></div>
        <div><span className="settings-eyebrow">{nl ? "Tegoed ontvangen" : "Credit received"}</span><strong>{formatEuro(data.earnedCents)}</strong></div>
        <div><span className="settings-eyebrow">{nl ? "Onderweg" : "On its way"}</span><strong>{formatEuro(data.pendingCents)}</strong></div>
      </div>
      <p className="settings-referral-note">{nl ? "Tegoed komt 30 dagen na de eerste betaling van je doorverwezen klant op je abonnement en wordt verrekend met je volgende factuur. Loopt je abonnement via Shopify, dan regelen we het tegoed met je." : "Credit is added to your plan 30 days after your referral's first payment and is deducted from your next invoice. Billed through Shopify? We'll settle the credit with you."}</p>
      {full ? <Notice tone="success" title={nl ? "Je hebt het maximum bereikt" : "You've reached the maximum"}>{nl ? "Blijf gerust doorverwijzen. Wil je ervoor betaald krijgen, word dan affiliate." : "Feel free to keep referring. Want to get paid for it? Become an affiliate."}</Notice> : null}
    </Section>
    <Section icon={<ExternalLink size={18} />} title={nl ? "Meer dan 5? Word affiliate" : "More than 5? Become an affiliate"} description={nl ? "Als affiliate verdien je 5% van wat je eerste 5 klanten betalen en 10% vanaf klant 6, zolang ze klant blijven. Uitbetaald in geld, zonder maximum." : "As an affiliate you earn 5% of what your first 5 customers pay and 10% from customer 6, for as long as they stay. Paid out in cash, no cap."}>
      <a className="settings-btn" href={`${SITE_ORIGIN}/affiliate`} target="_blank" rel="noreferrer"><ExternalLink size={14} />{nl ? "Bekijk het affiliateprogramma" : "View the affiliate program"}</a>
    </Section>
  </div>;
}
