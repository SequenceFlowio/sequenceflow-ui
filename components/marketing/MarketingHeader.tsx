import Image from "next/image";
import Link from "next/link";

import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import type { NavLink } from "@/lib/marketing/products";

import { MarketingCta } from "./MarketingCta";

// Absoluut, want op sequenceflow.io is / de bedrijfspagina en staan deze
// secties op de Support One-landing van het app-domein.
const SUPPORT_NAV: NavLink[] = [
  { href: `${DEFAULT_APP_ORIGIN}/#voorbeelden`, label: "Voorbeelden" },
  { href: `${DEFAULT_APP_ORIGIN}/#features`, label: "Functies" },
  { href: `${DEFAULT_APP_ORIGIN}/#werking`, label: "Werking" },
  { href: "/pricing", label: "Prijzen" },
  { href: "/blog", label: "Blog" },
];

type Props = {
  /** Label naast het logo; leeg = alleen het SequenceFlow-logo. */
  product?: string;
  homeHref?: string;
  nav?: NavLink[];
  cta?: NavLink;
  /** Inloggen hoort bij Support One; de andere pagina's hebben (nog) geen app. */
  showLogin?: boolean;
};

export function MarketingHeader({
  product = "Support One",
  homeHref = "/",
  nav = SUPPORT_NAV,
  cta = { href: "/login?intent=signup", label: "Start gratis" },
  showLogin = true,
}: Props) {
  return (
    <header className="mk-header">
      <a className="so-skip" href="#main-content">Naar de inhoud</a>
      <Link href={homeHref} className="mk-logo" aria-label={`${product ? `SequenceFlow ${product}` : "SequenceFlow"} home`}>
        <Image src="/logo-white.png" alt="SequenceFlow" width={190} height={46} priority />
        {product && <span>{product}</span>}
      </Link>
      <nav className="mk-nav" aria-label="Hoofdnavigatie">
        {nav.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
      </nav>
      <div className="mk-header-actions">
        {showLogin && <Link href="/login" className="mk-login-link">Inloggen</Link>}
        <MarketingCta href={cta.href}>{cta.label}</MarketingCta>
      </div>
      <details className="so-mobile-menu">
        <summary aria-label="Navigatiemenu">Menu <span aria-hidden>☰</span></summary>
        <nav aria-label="Mobiele navigatie">
          {nav.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          {!nav.some((link) => link.href === "/contact") && <Link href="/contact">Contact</Link>}
          {showLogin && <Link href="/login">Inloggen</Link>}
        </nav>
      </details>
    </header>
  );
}
