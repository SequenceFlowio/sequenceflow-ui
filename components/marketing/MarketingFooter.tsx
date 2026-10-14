import Image from "next/image";
import Link from "next/link";

import { LEGAL_PAGES } from "@/lib/site";

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div>
        <div className="mk-footer-brand">
          <Image src="/logo-white.png" alt="SequenceFlow" width={170} height={42} />
          <span>Support One</span>
        </div>
        <p>AI-klantenservice met menselijke controle.</p>
      </div>
      <div className="mk-footer-links">
        <Link href="/pricing">Prijzen</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Voorwaarden</Link>
      </div>
      <nav className="mk-footer-legal" aria-label="Juridisch">
        {LEGAL_PAGES.map((page) => <Link key={page.path} href={page.path}>{page.label}</Link>)}
      </nav>
      <p className="mk-footer-meta">SequenceFlow Support One · KvK 78237750 · Nederland</p>
    </footer>
  );
}
