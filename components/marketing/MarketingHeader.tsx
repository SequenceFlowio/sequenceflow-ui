import Image from "next/image";
import Link from "next/link";

import { MarketingCta } from "./MarketingCta";

export function MarketingHeader() {
  return (
    <header className="mk-header">
      <Link href="/" className="mk-logo" aria-label="SequenceFlow Commerce Support home">
        <Image src="/logo-black.png" alt="SequenceFlow" width={190} height={46} priority />
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
