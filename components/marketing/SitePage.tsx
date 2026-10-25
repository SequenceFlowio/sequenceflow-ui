import type { ReactNode } from "react";

import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";

/** Header and footer of the website around a content page (blog, contact, legal). */
export function SitePage({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="mk-page">
      <MarketingHeader />
      <main id="main-content" className={narrow ? "mk-site-main mk-site-main--narrow" : "mk-site-main"}>
        {children}
      </main>
      {/* Blog, contact en juridische pagina's horen bij het bedrijf, niet bij één product. */}
      <MarketingFooter product="" tagline="AI-agents voor e-commerce ondernemers." />
    </div>
  );
}
