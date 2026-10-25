import Image from "next/image";
import Link from "next/link";

import { PRODUCTS } from "@/lib/marketing/products";
import type { ChatContext } from "@/lib/marketing/siteChat";
import { LEGAL_PAGES } from "@/lib/site";

import { SiteChat } from "./SiteChat";

// Elke websitepagina heeft deze footer, dus de chat hangt hier ook aan. Het
// productlabel bepaalt waar de chat over begint en welke mascotte hij toont.
const CHAT_CONTEXT: Record<string, ChatContext> = { [PRODUCTS.support.name]: "support", [PRODUCTS.content.name]: "content" };

export function MarketingFooter({ product = "Support One", tagline = "AI-klantenservice met menselijke controle." }: {
  /** Label naast het logo; leeg = alleen het SequenceFlow-logo. */
  product?: string;
  tagline?: string;
}) {
  return (
    <>
    <SiteChat context={CHAT_CONTEXT[product] ?? "hub"} />
    <footer className="mk-footer">
      <div>
        <div className="mk-footer-brand">
          <Image src="/logo-white.png" alt="SequenceFlow" width={170} height={42} />
          {product && <span>{product}</span>}
        </div>
        <p>{tagline}</p>
      </div>
      <div className="mk-footer-links">
        <Link href={PRODUCTS.support.href}>{PRODUCTS.support.name}</Link>
        <Link href={PRODUCTS.content.href}>{PRODUCTS.content.name}</Link>
        <Link href="/pricing">Prijzen</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Voorwaarden</Link>
      </div>
      <nav className="mk-footer-legal" aria-label="Juridisch">
        {LEGAL_PAGES.map((page) => <Link key={page.path} href={page.path}>{page.label}</Link>)}
      </nav>
      <p className="mk-footer-meta">SequenceFlow · KvK 78237750 · Nederland</p>
    </footer>
    </>
  );
}
