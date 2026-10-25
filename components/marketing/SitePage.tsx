import type { ReactNode } from "react";

import { SITE_NAV } from "@/lib/marketing/products";

import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";

/** Header and footer of the website around a content page (blog, contact, legal). */
export function SitePage({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="mk-page">
      {/* Blog, contact en juridisch horen bij het bedrijf: dus het menu van de bedrijfspagina. */}
      <MarketingHeader product="" nav={SITE_NAV} cta={{ href: "/#producten", label: "Kies je agent" }} showLogin={false} />
      <main id="main-content" className={narrow ? "mk-site-main mk-site-main--narrow" : "mk-site-main"}>
        {children}
      </main>
      {/* Blog, contact en juridische pagina's horen bij het bedrijf, niet bij één product. */}
      <MarketingFooter product="" tagline="AI-agents voor e-commerce ondernemers." />
    </div>
  );
}
