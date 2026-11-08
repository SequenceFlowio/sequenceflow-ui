import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";

import { ContactIntake } from "@/components/marketing/ContactIntake";
import { SitePage } from "@/components/marketing/SitePage";
import { WHATSAPP_DISPLAY, whatsappLink } from "@/lib/marketing/contactIntake";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/contact",
  variant: "contact",
  title: "Contact | SequenceFlow",
  shareTitle: "Kennismaken met Support One | SequenceFlow",
  description: "Vragen over Support One? App ons op WhatsApp, mail hallo@sequenceflow.io of vertel in drie korte stappen waar we je mee kunnen helpen.",
});

// Links de vragenlijst (de beste route voor ons om goed te helpen), rechts de
// snelle routes: WhatsApp en mail.
export default function ContactPage() {
  return (
    <SitePage>
      <header className="mk-site-intro">
        <div className="mk-eyebrow"><span />CONTACT</div>
        <h1>Even sparren over je supportinbox?</h1>
        <p>Vertel in drie korte stappen waar je staat, of app ons direct. We reageren binnen één werkdag.</p>
      </header>
      <div className="cx-layout">
        <ContactIntake />
        <aside className="cx-side" aria-label="Direct contact">
          <a className="cx-whatsapp" href={whatsappLink()} target="_blank" rel="noopener noreferrer">
            <span className="cx-whatsapp-icon"><MessageCircle size={22} /></span>
            <span><strong>App ons op WhatsApp</strong><small>Voor vragen en support · {WHATSAPP_DISPLAY}</small></span>
          </a>
          <a className="cx-direct" href="mailto:hallo@sequenceflow.io">
            <span className="cx-direct-icon"><Mail size={20} /></span>
            <span><strong>Mail ons</strong><small>hallo@sequenceflow.io</small></span>
          </a>
          <dl className="cx-facts">
            <div><dt>Reactie</dt><dd>Binnen één werkdag</dd></div>
            <div><dt>KvK</dt><dd>78237750</dd></div>
            <div><dt>Vestiging</dt><dd>Nederland</dd></div>
          </dl>
        </aside>
      </div>
    </SitePage>
  );
}
