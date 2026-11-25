import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { SitePage } from "@/components/marketing/SitePage";
import { AFFILIATE, formatEuro } from "@/lib/referrals/program";
import { getLeaderboard, leaderboardIsDemo } from "@/lib/referrals/server";
import { catalogPlan, formatPlanPrice } from "@/lib/planCatalog";

import { AffiliateCalculator, AffiliateSignup } from "./AffiliateForms";
import "./affiliate.css";

type Lang = "nl" | "en";

const growth = catalogPlan("pro");
const euro = (amount: number) => `€${amount.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const newCustomerPercent = Math.round(AFFILIATE.newCustomerRate * 100);

const COPY = {
  nl: {
    eyebrow: "AFFILIATEPROGRAMMA",
    title: "Verdien mee aan elke webshop die je naar ons stuurt.",
    intro: "Je krijgt 10% van wat je klanten betalen, zolang ze klant blijven, zonder plafond. Zij krijgen 10% korting op hun eerste maand. Je hebt geen account nodig.",
    beta: "Het programma is in beta: we schaven nog aan de details. Wat je verdient, blijft van jou, en wijzigingen hoor je minstens 30 dagen vooraf.",
    signupAnchor: "aanmelden", rulesAnchor: "voorwaarden",
    signup: "Meld je aan", viewBoard: "Bekijk het leaderboard",
    tiersLabel: "Commissie",
    youGet: "Jij krijgt", youGetText: "van elke betaling van je klanten, elke maand",
    theyGet: "Jouw klant krijgt", theyGetText: "korting op de eerste betaalde maand",
    term: "Looptijd", termText: "zolang je klant betaalt, zonder maximum",
    exampleEyebrow: "REKENVOORBEELD", exampleTitle: "Wat levert het op?",
    example: (price: string, cut: string) => `Een webshop op Growth betaalt ${price} per maand. Dat is ${cut} per maand voor jou, zolang ze klant blijven. Schuif en kijk wat jouw netwerk waard is.`,
    boardDemo: "Zo ziet het leaderboard eruit", boardTitle: "Top 10 affiliates",
    boardDemoNote: "Voorbeeld met fictieve namen en bedragen. Dit zijn geen echte verdiensten.",
    customers: "klanten", perMonth: "p/m",
    boardNote: "Klanten = betalende webshops. Bedrag = geschatte commissie per maand bij het huidige abonnement van hun klanten.",
    steps: [
      ["Meld je aan", "Kies een gebruikersnaam. Die komt in je link en op het leaderboard."],
      ["Deel je link of code", "sequenceflow.io/r/jouwnaam in je content, of je code jouwnaam in een video of podcast. Je klant krijgt 10% korting op de eerste maand."],
      ["Verdien maandelijks", "In je dashboard zie je hoeveel mensen de proef starten, gaan betalen of afhaken. We betalen elke maand uit."],
    ],
    faqEyebrow: "VEELGESTELDE VRAGEN", faqTitle: "Goed om te weten",
    faq: [
      { q: "Moet ik zelf klant zijn?", a: "Nee. Iedereen kan meedoen: bureaus, freelancers, creators, consultants en tevreden klanten. Ben je klant en wil je alleen een paar ondernemers doorsturen? Dan is doorverwijzen in de app (tegoed op je abonnement) misschien handiger." },
      { q: "Wanneer word ik uitbetaald?", a: `Commissie wordt ${AFFILIATE.holdDays} dagen na de betaling van je klant uitbetaalbaar; zo tellen terugbetalingen en chargebacks niet mee. We betalen één keer per maand uit per bankoverschrijving, zonder minimumbedrag.` },
      { q: "Wat krijgen mijn klanten?", a: `${newCustomerPercent}% korting op hun eerste betaalde maand. Die staat automatisch klaar als ze via jouw link komen of jouw code invullen, en wordt verrekend met hun eerste factuur.` },
      { q: "Hoe lang verdien ik aan een klant?", a: "Zolang de klant betaalt. Er is geen einddatum en geen maximum aantal klanten." },
      { q: "Link of code: wat is het verschil?", a: "Geen. Je code is je gebruikersnaam. De link onthoudt hem 60 dagen in de browser van de bezoeker; de code kan iemand zelf invullen bij het aanmelden of tijdens de proef. Handig als je niet kunt linken, zoals in een video of podcast." },
      { q: "Wanneer telt een klant als de mijne?", a: "Als die een account aanmaakt binnen 60 dagen na een klik op jouw link, of jouw code invult vóór de eerste betaling. Klikt iemand daarna op de link van een ander, dan telt de laatste klik. Een klant telt als betalend na de eerste betaalde factuur, dus na de gratis proefperiode." },
      { q: "Hoe zit het met factuur en belasting?", a: "Ben je ondernemer, dan maken wij elke maand namens jou de factuur op (self-billing), met btw als je btw-plichtig bent. Doe je mee als particulier, dan moeten we je uitbetalingen mogelijk doorgeven aan de Belastingdienst. Je ontvangt de bedragen dan zonder btw." },
      { q: "Telt een klant die via de Shopify App Store betaalt ook?", a: "Commissie geldt voor abonnementen die bij SequenceFlow zelf worden afgerekend. Abonnementen via de Shopify App Store tellen nog niet mee; dat breiden we later uit." },
    ],
    rulesTitle: "Spelregels",
    rules: [
      "Jezelf, je eigen bedrijf of je eigen workspaces doorverwijzen telt niet.",
      "Niet adverteren op de merknaam SequenceFlow of Support One, en geen spam, nepreviews of misleidende beloftes.",
      "Wordt een betaling terugbetaald of teruggeboekt, dan vervalt de commissie daarop.",
      "Commissie wordt berekend over het betaalde bedrag exclusief btw.",
      "We kunnen deelname stopzetten bij misbruik. Wijzigen we de regels, dan hoor je dat minstens 30 dagen vooraf; wat je al verdiend hebt, blijft van jou.",
    ],
  },
  en: {
    eyebrow: "AFFILIATE PROGRAMME",
    title: "Earn from every store you send our way.",
    intro: "You get 10% of what your customers pay, for as long as they stay customers, with no cap. They get 10% off their first month. You don't need an account.",
    beta: "The programme is in beta: we're still fine-tuning the details. What you earn stays yours, and you'll hear about changes at least 30 days in advance.",
    signupAnchor: "signup", rulesAnchor: "rules",
    signup: "Sign up", viewBoard: "View the leaderboard",
    tiersLabel: "Commission",
    youGet: "You get", youGetText: "of every payment from your customers, every month",
    theyGet: "Your customer gets", theyGetText: "off their first paid month",
    term: "Duration", termText: "for as long as your customer pays, no maximum",
    exampleEyebrow: "EXAMPLE", exampleTitle: "What's it worth?",
    example: (price: string, cut: string) => `A store on Growth pays ${price} per month. That's ${cut} per month for you, for as long as they stay a customer. Slide to see what your network is worth.`,
    boardDemo: "This is what the leaderboard looks like", boardTitle: "Top 10 affiliates",
    boardDemoNote: "Example with fictional names and amounts. These are not real earnings.",
    customers: "customers", perMonth: "/mo",
    boardNote: "Customers = paying stores. Amount = estimated monthly commission at their customers' current plan.",
    steps: [
      ["Sign up", "Pick a username. It goes into your link and onto the leaderboard."],
      ["Share your link or code", "sequenceflow.io/r/yourname in your content, or your code yourname in a video or podcast. Your customer gets 10% off their first month."],
      ["Earn every month", "Your dashboard shows how many people start the trial, start paying or drop off. We pay out every month."],
    ],
    faqEyebrow: "FREQUENTLY ASKED QUESTIONS", faqTitle: "Good to know",
    faq: [
      { q: "Do I need to be a customer myself?", a: "No. Anyone can join: agencies, freelancers, creators, consultants and happy customers. Are you a customer and only want to refer a few business owners? Then referring from within the app (credit on your subscription) may be easier." },
      { q: "When do I get paid?", a: `Commission becomes payable ${AFFILIATE.holdDays} days after your customer's payment, so refunds and chargebacks don't count. We pay out once a month by bank transfer, with no minimum amount.` },
      { q: "What do my customers get?", a: `${newCustomerPercent}% off their first paid month. It's applied automatically when they come through your link or enter your code, and is deducted from their first invoice.` },
      { q: "How long do I earn from a customer?", a: "For as long as the customer pays. There is no end date and no maximum number of customers." },
      { q: "Link or code: what's the difference?", a: "None. Your code is your username. The link remembers it for 60 days in the visitor's browser; the code can be entered when signing up or during the trial. Handy when you can't link, like in a video or podcast." },
      { q: "When does a customer count as mine?", a: "When they create an account within 60 days of clicking your link, or enter your code before their first payment. If someone later clicks another affiliate's link, the last click counts. A customer counts as paying after their first paid invoice, so after the free trial." },
      { q: "What about invoices and tax?", a: "If you're a business, we create the invoice on your behalf every month (self-billing), with VAT if you're VAT-registered. If you join as a private individual, we may have to report your payouts to the Dutch Tax Administration. You then receive the amounts without VAT." },
      { q: "Does a customer who pays through the Shopify App Store count?", a: "Commission applies to subscriptions paid directly to SequenceFlow. Subscriptions through the Shopify App Store don't count yet; we'll extend this later." },
    ],
    rulesTitle: "Programme rules",
    rules: [
      "Referring yourself, your own business or your own workspaces doesn't count.",
      "No advertising on the brand names SequenceFlow or Support One, and no spam, fake reviews or misleading promises.",
      "If a payment is refunded or charged back, the commission on it lapses.",
      "Commission is calculated on the amount paid excluding VAT.",
      "We can end participation in case of misuse. If we change the rules, you'll hear about it at least 30 days in advance; what you've already earned stays yours.",
    ],
  },
};

/** De affiliatepagina, op /nl/affiliate en /en/affiliate. */
export async function AffiliateLanding({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const leaderboard = await getLeaderboard(10).catch(() => []);
  return (
    <SitePage lang={lang}>
      <MarketingAttribution page={`/${lang}/affiliate`} />
      <section className="af-hero">
        <div className="af-hero-label"><div className="mk-eyebrow"><span />{t.eyebrow}</div><span className="af-beta">Beta</span></div>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
        <p className="af-beta-note">{t.beta}</p>
        <div className="af-hero-actions">
          <a className="mk-button mk-button--primary" href={`#${t.signupAnchor}`}>{t.signup}</a>
          <a className="mk-button mk-button--secondary" href="#leaderboard">{t.viewBoard}</a>
        </div>
      </section>

      <section className="af-tiers" aria-label={t.tiersLabel}>
        <article className="is-up"><span>{t.youGet}</span><strong>10%</strong><p>{t.youGetText}</p></article>
        <article><span>{t.theyGet}</span><strong>10%</strong><p>{t.theyGetText}</p></article>
        <article><span>{t.term}</span><strong>∞</strong><p>{t.termText}</p></article>
      </section>

      <section className="af-split">
        <div>
          <div className="mk-eyebrow"><span />{t.exampleEyebrow}</div>
          <h2>{t.exampleTitle}</h2>
          <p>{t.example(formatPlanPrice(growth.price), euro(growth.price * AFFILIATE.rate))}</p>
        </div>
        <AffiliateCalculator lang={lang} />
      </section>

      <section className="af-board" id="leaderboard">
        <div className="af-board-head">
          <div>
            <div className="mk-eyebrow"><span />LEADERBOARD</div>
            <h2>{leaderboardIsDemo() ? t.boardDemo : t.boardTitle}</h2>
            {leaderboardIsDemo() && <p className="af-board-note">{t.boardDemoNote}</p>}
          </div>
        </div>
        <ol className="af-board-list">
          {leaderboard.map((row, i) => (
            <li key={row.username} className={i < 3 ? "is-top" : undefined}>
              <span className="af-rank">{i + 1}</span>
              <span className="af-user">@{row.username}</span>
              <span className="af-num"><strong>{row.customers}</strong> {t.customers}</span>
              <span className="af-num af-mrr"><strong>{formatEuro(row.estimatedMonthlyCents)}</strong> {t.perMonth}</span>
            </li>
          ))}
        </ol>
        <p className="af-board-note">{t.boardNote}</p>
      </section>

      <section className="af-steps">
        {t.steps.map(([title, text], i) => <article key={title}><span>{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}
      </section>

      <AffiliateSignup lang={lang} />

      <section className="mk-faq af-faq">
        <div className="mk-section-heading"><span>{t.faqEyebrow}</span><h2>{t.faqTitle}</h2></div>
        <div>{t.faq.map((item) => <details key={item.q}><summary>{item.q}<span>+</span></summary><p>{item.a}</p></details>)}</div>
      </section>

      <section className="af-terms" id={t.rulesAnchor}>
        <h2>{t.rulesTitle}</h2>
        <ul>{t.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      </section>
    </SitePage>
  );
}
