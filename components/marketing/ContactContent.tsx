import { Mail, MessageCircle } from "lucide-react";

import { ContactIntake } from "@/components/marketing/ContactIntake";
import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { SitePage } from "@/components/marketing/SitePage";
import { WHATSAPP_DISPLAY, WHATSAPP_TEXT_EN, whatsappLink } from "@/lib/marketing/contactIntake";

const COPY = {
  nl: {
    title: "Even sparren over je supportinbox?",
    intro: "Vertel in drie korte stappen waar je staat, of app ons direct. We reageren binnen één werkdag.",
    direct: "Direct contact", whatsapp: "App ons op WhatsApp", whatsappSub: "Voor vragen en support", mail: "Mail ons",
    reply: "Reactie", replyValue: "Binnen één werkdag", kvk: "KvK", location: "Vestiging", country: "Nederland",
  },
  en: {
    title: "Want to talk about your support inbox?",
    intro: "Tell us where you stand in three short steps, or message us directly. We reply within one working day.",
    direct: "Direct contact", whatsapp: "Message us on WhatsApp", whatsappSub: "For questions and support", mail: "Email us",
    reply: "Reply", replyValue: "Within one working day", kvk: "Chamber of Commerce", location: "Based in", country: "the Netherlands",
  },
};

// Links de vragenlijst (de beste route voor ons om goed te helpen), rechts de
// snelle routes: WhatsApp en mail. Zelfde pagina op /nl/contact en /en/contact.
export function ContactContent({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const t = COPY[lang];
  const en = lang === "en";
  return (
    <SitePage lang={lang}>
      <MarketingAttribution page={`/${lang}/contact`} />
      <header className="mk-site-intro">
        <div className="mk-eyebrow"><span />CONTACT</div>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </header>
      <div className="cx-layout">
        <ContactIntake lang={lang} />
        <aside className="cx-side" aria-label={t.direct}>
          <a className="cx-whatsapp" href={en ? whatsappLink(WHATSAPP_TEXT_EN) : whatsappLink()} target="_blank" rel="noopener noreferrer">
            <span className="cx-whatsapp-icon"><MessageCircle size={22} /></span>
            <span><strong>{t.whatsapp}</strong><small>{t.whatsappSub} · {WHATSAPP_DISPLAY}</small></span>
          </a>
          <a className="cx-direct" href="mailto:hallo@sequenceflow.io">
            <span className="cx-direct-icon"><Mail size={20} /></span>
            <span><strong>{t.mail}</strong><small>hallo@sequenceflow.io</small></span>
          </a>
          <dl className="cx-facts">
            <div><dt>{t.reply}</dt><dd>{t.replyValue}</dd></div>
            <div><dt>{t.kvk}</dt><dd>78237750</dd></div>
            <div><dt>{t.location}</dt><dd>{t.country}</dd></div>
          </dl>
        </aside>
      </div>
    </SitePage>
  );
}
