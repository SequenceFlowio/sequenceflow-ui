"use client";

import { useState } from "react";

import { Turnstile } from "@/components/Turnstile";
import { PAID_PLAN_CATALOG } from "@/lib/planCatalog";
import { estimatedMonthlyCommission, formatEuro, normalizeUsername, usernameProblem } from "@/lib/referrals/program";

type Lang = "nl" | "en";

const COPY = {
  nl: {
    customers: "Klanten die je binnenbrengt", plan: "Abonnement", perMonth: "Per maand", perYear: "Per jaar",
    yourname: "jouwnaam", failed: "Aanmelden lukte niet.",
    eyebrow: "AANMELDEN", title: "Binnen een minuut je eigen link.",
    intro: "Je hebt geen SequenceFlow-account nodig. Na het aanmelden krijg je je link meteen, en per mail je persoonlijke dashboard.",
    done: "Je bent aangemeld.", yourLink: "Dit is jouw affiliatelink:", orCode: "Of deel je code:",
    codeExplain: "Wie die invult bij het aanmelden of tijdens de proef, krijgt 10% korting op de eerste maand en telt als jouw klant. Handig in een video of podcast, waar je niet kunt linken.",
    mailSent: "We hebben je een mail gestuurd met je dashboard. Zie je hem niet? Kijk dan in je spammap.",
    username: "Gebruikersnaam", usernamePlaceholder: "bijv. webshopwouter", linkPreview: "Je link:",
    name: "Naam", email: "E-mail", channel: "Waar ga je het delen?", optional: "(optioneel)",
    channelPlaceholder: "Bijv. Instagram, nieuwsbrief, bureau met 30 webshopklanten",
    business: "Ik doe mee als ondernemer (met KvK-nummer)", company: "Bedrijfsnaam", kvk: "KvK-nummer",
    vat: "Btw-nummer", vatHint: "(als je btw-plichtig bent)", leaderboard: "Toon mijn gebruikersnaam op het leaderboard",
    agree: "Ik ga akkoord met de", rules: "spelregels", busy: "Bezig…", submit: "Maak mijn link",
  },
  en: {
    customers: "Customers you bring in", plan: "Plan", perMonth: "Per month", perYear: "Per year",
    yourname: "yourname", failed: "Signing up failed.",
    eyebrow: "SIGN UP", title: "Your own link within a minute.",
    intro: "You don't need a SequenceFlow account. After signing up you get your link right away, and your personal dashboard by email.",
    done: "You're signed up.", yourLink: "This is your affiliate link:", orCode: "Or share your code:",
    codeExplain: "Anyone who enters it when signing up or during the trial gets 10% off their first month and counts as your customer. Handy in a video or podcast, where you can't link.",
    mailSent: "We've sent you an email with your dashboard. Can't find it? Check your spam folder.",
    username: "Username", usernamePlaceholder: "e.g. storecoach", linkPreview: "Your link:",
    name: "Name", email: "Email", channel: "Where will you share it?", optional: "(optional)",
    channelPlaceholder: "E.g. Instagram, newsletter, agency with 30 store clients",
    business: "I'm joining as a business (with a company registration number)", company: "Company name", kvk: "Company registration number (KvK)",
    vat: "VAT number", vatHint: "(if you're VAT-registered)", leaderboard: "Show my username on the leaderboard",
    agree: "I agree to the", rules: "programme rules", busy: "Working…", submit: "Create my link",
  },
};

const PLANS = PAID_PLAN_CATALOG.map((plan) => ({ id: plan.slug, name: plan.name, cents: plan.price * 100 }));

export function AffiliateCalculator({ lang = "nl" }: { lang?: Lang }) {
  const t = COPY[lang];
  const [customers, setCustomers] = useState(10);
  const [plan, setPlan] = useState(PLANS[1]);
  const monthly = estimatedMonthlyCommission(Array(customers).fill(plan.cents));
  return (
    <div className="af-calc">
      <label>
        <span>{t.customers} <strong>{customers}</strong></span>
        <input type="range" min={1} max={50} value={customers} onChange={(e) => setCustomers(Number(e.target.value))} />
      </label>
      <div className="af-calc-plans" role="radiogroup" aria-label={t.plan}>
        {PLANS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={plan.id === p.id} className={plan.id === p.id ? "is-selected" : ""} onClick={() => setPlan(p)}>{p.name} <small>{formatEuro(p.cents)}</small></button>)}
      </div>
      <div className="af-calc-result">
        <div><span>{t.perMonth}</span><strong>{formatEuro(monthly)}</strong></div>
        <div><span>{t.perYear}</span><strong>{formatEuro(monthly * 12)}</strong></div>
      </div>
    </div>
  );
}

export function AffiliateSignup({ lang = "nl" }: { lang?: Lang }) {
  const t = COPY[lang];
  const anchor = lang === "en" ? "rules" : "voorwaarden";
  const [username, setUsername] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ link: string; code: string } | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const preview = normalizeUsername(username) || t.yourname;
  const usernameError = username ? usernameProblem(username, lang) : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/affiliate/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username, name: form.get("name"), email: form.get("email"), isBusiness,
          companyName: form.get("companyName"), kvkNumber: form.get("kvkNumber"), vatNumber: form.get("vatNumber"),
          channel: form.get("channel"), showOnLeaderboard: form.get("showOnLeaderboard") === "on",
          acceptTerms: form.get("acceptTerms") === "on", website: form.get("website"), lang, captchaToken: captcha,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.failed);
      setDone({ link: data.link, code: normalizeUsername(username) });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
      setCaptchaReset((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="af-signup" id={lang === "en" ? "signup" : "aanmelden"}>
      <div className="af-signup-copy">
        <div className="mk-eyebrow"><span />{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p>{t.intro}</p>
      </div>
      <div className="af-signup-card">
        {done ? (
          <div className="af-done" role="status">
            <strong>{t.done}</strong>
            <p>{t.yourLink}</p>
            <code>{done.link}</code>
            <p>{t.orCode} <b className="af-code">{done.code}</b>. {t.codeExplain}</p>
            <p>{t.mailSent}</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <label className="af-wide">
              <span>{t.username}</span>
              <input name="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t.usernamePlaceholder} autoComplete="off" required aria-invalid={Boolean(usernameError)} />
              <small className={usernameError ? "is-error" : undefined}>{usernameError ?? `${t.linkPreview} sequenceflow.io/r/${preview}`}</small>
            </label>
            <label><span>{t.name}</span><input name="name" autoComplete="name" required /></label>
            <label><span>{t.email}</span><input name="email" type="email" autoComplete="email" required /></label>
            <label className="af-wide"><span>{t.channel} <small>{t.optional}</small></span><input name="channel" placeholder={t.channelPlaceholder} /></label>
            <label className="af-check af-wide"><input type="checkbox" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} /><span>{t.business}</span></label>
            {isBusiness ? <>
              <label><span>{t.company}</span><input name="companyName" autoComplete="organization" /></label>
              <label><span>{t.kvk}</span><input name="kvkNumber" inputMode="numeric" /></label>
              <label className="af-wide"><span>{t.vat} <small>{t.vatHint}</small></span><input name="vatNumber" /></label>
            </> : null}
            <label className="af-check af-wide"><input type="checkbox" name="showOnLeaderboard" defaultChecked /><span>{t.leaderboard}</span></label>
            <label className="af-check af-wide"><input type="checkbox" name="acceptTerms" required /><span>{t.agree} <a href={`#${anchor}`}>{t.rules}</a></span></label>
            <input className="af-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <div className="af-wide"><Turnstile onToken={setCaptcha} resetKey={captchaReset} lang={lang} /></div>
            {error ? <p className="af-error af-wide" role="alert">{error}</p> : null}
            <button className="mk-button mk-button--primary af-wide" disabled={busy || Boolean(usernameError) || !username}>{busy ? t.busy : t.submit}</button>
          </form>
        )}
      </div>
    </section>
  );
}
