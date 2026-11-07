import Link from "next/link";
import { ArrowRight, Check, FileText, Mail, Package, ShieldCheck, Sparkles } from "lucide-react";

import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { LOWEST_PLAN_PRICE } from "@/lib/planCatalog";

import { MarketingCta } from "./MarketingCta";
import { SequenceMark } from "./SequenceMark";

/**
 * De Engelse site (eerste stap richting VK, Ierland en de VS). Alleen wat
 * Support One vandaag echt kan; prijzen voorlopig in euro.
 */

/**
 * Navigatie van de Engelse site. /en is de Support One-pagina (de Engelse
 * bedrijfspagina staat in archive/content-one/); de NL-knop gaat naar dezelfde
 * pagina in het Nederlands.
 */
export function EnglishNav({ product = "Support One", nlHref = "/support-one" }: {
  /** Label naast het logo; leeg op de bedrijfspagina. */
  product?: string;
  nlHref?: string;
}) {
  return (
    <header className="en-nav">
      <Link href="/en" className="en-logo"><SequenceMark size={30} gear={product ? "headset" : "antenna"} title="" /><span>SequenceFlow {product && <small>{product}</small>}</span></Link>
      <nav aria-label="Main">
        <a href="/en#how">How it works</a>
        <Link href="/en/pricing">Pricing</Link>
        <Link href={nlHref} hrefLang="nl" lang="nl" className="en-lang">NL</Link>
      </nav>
      <div className="en-actions">
        <a href={`${DEFAULT_APP_ORIGIN}/login`}>Log in</a>
        <MarketingCta href="/login?intent=signup&source=en">Start free trial</MarketingCta>
      </div>
    </header>
  );
}

export function EnglishFooter() {
  return (
    <footer className="en-footer">
      <div><SequenceMark size={26} title="" /><span>SequenceFlow · AI customer service for e-commerce, with a human in control.</span></div>
      <nav aria-label="Footer">
        <Link href="/en/pricing">Pricing</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a>
      </nav>
    </footer>
  );
}

const FEATURES = [
  { icon: Package, title: "The order, right there", text: "Connect Shopify or WooCommerce and Support One pulls the order and shipping details into every reply. No more tab-hopping to answer “where is my order?”." },
  { icon: FileText, title: "Your policies in every draft", text: "Add your returns policy, shipping info and product knowledge. Replies use the right passage, in your tone of voice." },
  { icon: ShieldCheck, title: "You stay in control", text: "Every draft waits for your approval by default. Turn on automatic sending later, for the questions you choose, at the times you choose." },
  { icon: Sparkles, title: "It learns how you write", text: "When you edit a draft, Support One suggests a rule from it. You decide which ones stick." },
];

const STEPS = [
  ["01", "Connect your mailbox", "Sign in with Google or connect any IMAP mailbox, so customer emails come in and replies leave from your own address."],
  ["02", "Add your knowledge", "Upload your policies and product info. Connect your store for live order data (optional)."],
  ["03", "Review your first draft", "Read it, tweak it, send it. Automate more once you trust it."],
];

const FAQ = [
  ["Does it send emails on its own?", "Not by default. Every draft waits for your approval. You can switch on automatic sending later for the questions you pick, with your own rules and send times."],
  ["Which mailboxes and stores work?", "Gmail (sign in with Google) and any mailbox with IMAP. For order data: Shopify (our app is in the Shopify App Store) and WooCommerce."],
  ["What does it cost?", `Plans start at €${LOWEST_PLAN_PRICE} a month and include a number of handled conversations. Above that you pay €0.49 per conversation you check, or €0.99 when the AI handles it on its own. You set a monthly budget, and you never pay above it.`],
  ["Is my data safe?", "Your data is never used to train AI models, and we sign a data processing agreement with every customer. Customer emails are treated as data, never as instructions."],
];

export function EnglishLanding() {
  return (
    <main id="main-content" className="en">
      <section className="en-hero">
        <div className="en-hero-copy">
          <p className="en-eyebrow"><span />AI customer service for online stores</p>
          <h1>Customer emails answered in your voice. <em>You just approve.</em></h1>
          <p>Support One reads every customer email, looks up the order and your policies, and drafts a reply that sounds like you. You check it and send it, or let it go out on its own for the questions you trust it with.</p>
          <div className="en-hero-actions">
            <MarketingCta href="/login?intent=signup&source=en">Start your 14-day free trial</MarketingCta>
            <a href="#how" className="en-link">How it works <ArrowRight size={15} /></a>
          </div>
          <ul className="en-trust"><li><Check size={14} /> No credit card</li><li><Check size={14} /> Human approval by default</li><li><Check size={14} /> Your own email address</li></ul>
        </div>
        <div className="en-demo" aria-label="Example: a customer question and the drafted reply">
          <div className="en-msg"><Mail size={15} /><div><strong>Emma · customer</strong><p>Hi, I ordered the linen shirt last week and it still hasn&apos;t arrived. Can you check?</p></div></div>
          <div className="en-context"><Package size={14} /> Order #1042 found · shipped Monday · in transit</div>
          <div className="en-draft">
            <div className="en-draft-head"><SequenceMark size={28} gear="headset" title="" /><span>Draft by Seffy · ready for your review</span></div>
            <p>Hi Emma, thanks for reaching out! Your linen shirt shipped on Monday and is on its way. You can follow it with your tracking link. If it hasn&apos;t arrived by Friday, just reply and we&apos;ll sort it out right away.</p>
            <div className="en-draft-actions"><span className="is-primary">Approve &amp; send</span><span>Edit</span></div>
          </div>
        </div>
      </section>

      <section className="en-features" aria-label="What Support One does">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <article key={title}><Icon size={20} /><h3>{title}</h3><p>{text}</p></article>
        ))}
      </section>

      <section className="en-pain">
        <div>
          <p className="en-eyebrow"><span />Pain points</p>
          <h2>See where customers get stuck, and fix it at the source.</h2>
          <p>Support One groups your customer questions into themes. You see which problem comes back most, with AI advice on what to change, so the same question comes in less often. Included from Growth.</p>
        </div>
        <ol>
          <li><b>14</b><span>Wheels missing from the toy car<small>Advice: spot-check boxes and ask your supplier to double-check the next delivery.</small></span></li>
          <li><b>9</b><span>Delivery time to Belgium<small>Advice: show delivery times per country on the product page.</small></span></li>
          <li><b>5</b><span>Batteries not included<small>Advice: say which batteries are needed in the description.</small></span></li>
        </ol>
      </section>

      <section className="en-steps" id="how">
        <h2>Up and running in three steps.</h2>
        <div>{STEPS.map(([n, title, text]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="en-price">
        <h2>Pay a fixed plan, plus only what actually gets solved.</h2>
        <p>From €{LOWEST_PLAN_PRICE} a month with 100 handled conversations included. Drafts, spam and follow-up questions never count. You set the maximum.</p>
        <Link href="/en/pricing" className="en-link">See plans and calculator <ArrowRight size={15} /></Link>
      </section>

      <section className="en-faq">
        <h2>Questions before you connect your mailbox</h2>
        {FAQ.map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}
      </section>

      <section className="en-final">
        <SequenceMark size={72} state="happy" gear="headset" title="" />
        <h2>Meet your new support teammate.</h2>
        <p>AI drafts for every customer email, with your team at the wheel.</p>
        <MarketingCta href="/login?intent=signup&source=en">Start free trial</MarketingCta>
      </section>
    </main>
  );
}
