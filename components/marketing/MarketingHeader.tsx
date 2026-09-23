import Image from "next/image";
import Link from "next/link";

import { MarketingCta } from "./MarketingCta";

export function MarketingHeader() {
  return (
    <header className="mk-header">
      <a className="so-skip" href="#main-content">Naar de inhoud</a>
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
      <details className="so-mobile-menu">
        <summary aria-label="Navigatiemenu">Menu <span aria-hidden>☰</span></summary>
        <nav aria-label="Mobiele navigatie">
          <Link href="/#features">Functies</Link>
          <Link href="/#voorbeelden">Voorbeelden</Link>
          <Link href="/#werking">Werking</Link>
          <Link href="/pricing">Prijzen</Link>
          <Link href="/login">Inloggen</Link>
        </nav>
      </details>
    </header>
  );
}
