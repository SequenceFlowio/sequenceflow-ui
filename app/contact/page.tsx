import type { Metadata } from "next";

import { MeetingRequest } from "@/components/marketing/MeetingRequest";
import { SitePage } from "@/components/marketing/SitePage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact | SequenceFlow",
  description: "Neem contact op met SequenceFlow of plan een kennismaking over Support One.",
  alternates: { canonical: `${SITE_ORIGIN}/contact` },
};

export default function ContactPage() {
  return (
    <SitePage>
      <header className="mk-site-intro">
        <div className="mk-eyebrow"><span />CONTACT</div>
        <h1>Even sparren over je supportinbox?</h1>
        <p>
          Mail ons op <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a>, of plan hieronder een kennismaking van twintig minuten.
          We reageren binnen één werkdag.
        </p>
      </header>
      <MeetingRequest />
      <dl className="mk-contact-facts">
        <div><dt>E-mail</dt><dd><a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a></dd></div>
        <div><dt>KvK</dt><dd>78237750</dd></div>
        <div><dt>Vestiging</dt><dd>Nederland</dd></div>
      </dl>
    </SitePage>
  );
}
