import Image from "next/image";
import Link from "next/link";

import { MarketingCta } from "./MarketingCta";

export function MarketingHeader() {
  return (
    <header className="mk-header">
      <Link href="/" className="mk-logo" aria-label="SequenceFlow Support One home">
        <Image src="/logo-white.png" alt="SequenceFlow" width={190} height={46} priority />
        <span>Support One</span>
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
