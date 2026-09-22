import Image from "next/image";
import Link from "next/link";

import { MarketingCta } from "./MarketingCta";
import { SequenceMark } from "./SequenceMark";

export function MarketingHeader() {
  return (
    <header className="mk-header">
      <Link href="/" className="mk-logo" aria-label="SequenceFlow Commerce Support home">
        {/* De mascotte kijkt de bezoeker na binnen 340px; daarbuiten dwaalt
            de blik vanzelf verder. */}
        <SequenceMark size={30} followPointer={340} className="mk-logo-mark" title="" />
        <Image src="/logo-white.png" alt="SequenceFlow" width={190} height={46} priority />
        <span>Commerce Support</span>
      </Link>
      <nav className="mk-nav" aria-label="Hoofdnavigatie">
        <Link href="/#werking">Werking</Link>
        <Link href="/#features">Functies</Link>
        <Link href="/pricing">Prijzen</Link>
      </nav>
      <div className="mk-header-actions">
        <Link href="/login" className="mk-login-link">Inloggen</Link>
        <MarketingCta href="/login?intent=signup">Start gratis</MarketingCta>
      </div>
    </header>
  );
}
