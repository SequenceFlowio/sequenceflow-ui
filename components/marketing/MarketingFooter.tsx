import Image from "next/image";
import Link from "next/link";

import { SequenceMark } from "./SequenceMark";

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      {/* Reuzencontour die van onderen opkomt: geeft de voet gewicht zonder
          ook maar iets van de inhoud te verdringen. */}
      <div className="mk-footer-mark" aria-hidden>
        <SequenceMark size={560} variant="outline" state="idle" title="" />
      </div>
      <div>
        <div className="mk-footer-brand">
          <Image src="/logo-white.png" alt="SequenceFlow" width={170} height={42} />
          <span>Support One</span>
        </div>
        <p>AI-klantenservice met menselijke controle.</p>
      </div>
      <div className="mk-footer-links">
        <Link href="/pricing">Prijzen</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Voorwaarden</Link>
        <a href="mailto:hallo@sequenceflow.io">Contact</a>
      </div>
      <p className="mk-footer-meta">SequenceFlow Support One · KvK 78237750 · Nederland</p>
    </footer>
  );
}
