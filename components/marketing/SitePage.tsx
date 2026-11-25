import type { ReactNode } from "react";

import { SITE_NAV } from "@/lib/marketing/products";

import { EnglishFooter, EnglishNav } from "./EnglishSite";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";

/** Header and footer of the website around a content page (blog, contact, legal), in Dutch or English. */
export function SitePage({ children, narrow = false, lang = "nl" }: { children: ReactNode; narrow?: boolean; lang?: "nl" | "en" }) {
  const main = <main id="main-content" className={narrow ? "mk-site-main mk-site-main--narrow" : "mk-site-main"}>{children}</main>;
  if (lang === "en") {
    return (
      <div className="mk-page" lang="en">
        <EnglishNav />
        {main}
        <EnglishFooter />
      </div>
    );
  }
  return (
    <div className="mk-page">
      {/* Blog, contact en juridisch horen bij het bedrijf: dus het menu van de bedrijfspagina. */}
      <MarketingHeader product="" nav={SITE_NAV} cta={{ href: "/nl", label: "Bekijk Support One" }} showLogin={false} />
      {main}
      {/* Blog, contact en juridische pagina's horen bij het bedrijf, niet bij één product. */}
      <MarketingFooter product="" tagline="AI-agents voor e-commerce ondernemers." />
    </div>
  );
}
