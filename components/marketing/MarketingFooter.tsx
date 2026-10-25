import Image from "next/image";
import Link from "next/link";

import { PRODUCTS } from "@/lib/marketing/products";
import type { ChatContext } from "@/lib/marketing/siteChat";
import { LEGAL_PAGES } from "@/lib/site";

import { SiteChat } from "./SiteChat";

// Elke websitepagina heeft deze footer, dus de chat hangt hier ook aan. Het
// productlabel bepaalt waar de chat over begint en welke mascotte hij toont.
const CHAT_CONTEXT: Record<string, ChatContext> = { [PRODUCTS.support.name]: "support", [PRODUCTS.content.name]: "content" };

// Per pagina alleen links die daar kloppen: prijzen en de Engelse
// app-voorwaarden horen bij Support One, niet bij het bedrijf of Content One.
const FOOTER_LINKS: Record<ChatContext, Array<{ href: string; label: string }>> = {
  hub: [
    { href: PRODUCTS.support.href, label: PRODUCTS.support.name },
    { href: PRODUCTS.content.href, label: PRODUCTS.content.name },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
  ],
  support: [
    { href: "/pricing", label: "Prijzen" },
    { href: PRODUCTS.content.href, label: PRODUCTS.content.name },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Voorwaarden" },
  ],
  content: [
    { href: `${PRODUCTS.content.href}#early-access`, label: "Early access" },
    { href: PRODUCTS.support.href, label: PRODUCTS.support.name },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
  ],
};

export function MarketingFooter({ product = "Support One", tagline = "AI-klantenservice met menselijke controle." }: {
  /** Label naast het logo; leeg = alleen het SequenceFlow-logo. */
  product?: string;
  tagline?: string;
}) {
  const context = CHAT_CONTEXT[product] ?? "hub";
  return (
    <>
    <SiteChat context={context} />
    <footer className="mk-footer">
      <div>
        <div className="mk-footer-brand">
          <Image src="/logo-white.png" alt="SequenceFlow" width={170} height={42} />
          {product && <span>{product}</span>}
        </div>
        <p>{tagline}</p>
      </div>
      <div className="mk-footer-links">
        {FOOTER_LINKS[context].map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
      </div>
      <nav className="mk-footer-legal" aria-label="Juridisch">
        {LEGAL_PAGES.map((page) => <Link key={page.path} href={page.path}>{page.label}</Link>)}
      </nav>
      <p className="mk-footer-meta">SequenceFlow · KvK 78237750 · Nederland</p>
    </footer>
    </>
  );
}
