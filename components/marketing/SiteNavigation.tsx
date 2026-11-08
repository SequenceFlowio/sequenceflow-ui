"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand";

type Section = "company";
// Eén product: leg de functie uit voordat bezoekers de agentnamen kennen.
const SECTIONS: Array<[Section, string]> = [["company", "Bedrijf"]];
const LINKS = {
  company: [
    { href: "/contact", title: "Kennismaken", description: "Bespreek wat jouw webshop nodig heeft." },
    { href: "/affiliate", title: "Partners & affiliates", description: "Groei met ons mee." },
    { href: "/blog", title: "Kennisbank & inzichten", description: "Praktische kennis voor je webshop." },
    { href: "/privacyverklaring", title: "Privacy & vertrouwen", description: "Hoe we omgaan met jouw gegevens." },
  ],
};

export function SiteNavigation({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const nl = lang === "nl";
  const [open, setOpen] = useState<Section | null>(null);
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<Section, HTMLButtonElement | null>>>({});
  const id = useId();
  const pathname = usePathname();
  // EN gaat naar dezelfde pagina in het Engels: /support-one/en is de Engelse
  // kopie van /support-one, /en/pricing die van /pricing.
  const languageHref = nl ? (pathname === "/pricing" ? "/en/pricing" : "/support-one/en") : (pathname === "/en/pricing" ? "/pricing" : "/support-one");
  const targetLang = nl ? "en" : "nl";
  const languageLabel = nl ? "Switch to English" : "Terug naar Nederlands";
  const home = nl ? "/support-one" : "/support-one/en";
  const companyLinks = nl ? LINKS.company : [
    { href: "/contact", title: "Contact", description: "Discuss what your store needs." },
    { href: "/affiliate", title: "Partners & affiliates", description: "Grow with us." },
    { href: "/blog", title: "Articles & insights", description: "Practical knowledge for your store (Dutch)." },
    { href: "/privacyverklaring", title: "Privacy & trust", description: "How we handle your data (Dutch)." },
  ];

  // Het paneel hangt onder zijn knop; die staat niet op een vaste plek nu het
  // menu korter is. Op mobiel staat het paneel in de stroom en telt left niet.
  useLayoutEffect(() => {
    const trigger = open ? triggers.current[open] : null;
    if (panel.current && trigger) panel.current.style.left = `${Math.max(0, trigger.offsetLeft - 12)}px`;
  }, [open]);

  useEffect(() => {
    if (!open && !mobile) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setOpen(null); setMobile(false); }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, mobile]);

  function close() { setOpen(null); setMobile(false); }

  return <header className="sn-header" ref={root} onMouseLeave={() => { if (!mobile) setOpen(null); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }} onKeyDown={event => {
    if (event.key === "Escape") {
      event.preventDefault();
      const active = open;
      setOpen(null);
      if (mobile) { setMobile(false); root.current?.querySelector<HTMLButtonElement>(".sn-mobile-toggle")?.focus(); }
      else if (active) triggers.current[active]?.focus();
    }
  }}>
    <a className="so-skip" href="#main-content">{nl ? "Naar de inhoud" : "Skip to content"}</a>
    <Link href={home} className="sn-logo" aria-label="SequenceFlow home"><Image src="/logo-white.png" alt="SequenceFlow" width={188} height={46} priority /></Link>
    <nav id={`${id}-navigation`} className={`sn-nav${mobile ? " is-open" : ""}`} aria-label={nl ? "Hoofdnavigatie" : "Main navigation"}>
      <a href={`${home}#functies`} onMouseEnter={() => { if (!mobile) setOpen(null); }} onClick={close}>{nl ? "Wat het doet" : "How it works"}</a>
      {SECTIONS.map(([section, label]) => <button type="button" key={section} ref={node => { triggers.current[section] = node; }} aria-expanded={open === section} aria-controls={`${id}-panel`} onMouseEnter={() => { if (!mobile) setOpen(section); }} onClick={() => setOpen(mobile && open === section ? null : section)} onKeyDown={event => {
        if (event.key === "ArrowDown") {
          event.preventDefault(); setOpen(section);
          requestAnimationFrame(() => panel.current?.querySelector<HTMLAnchorElement>("a")?.focus());
        }
      }}>{nl ? label : "Company"}<ChevronDown size={12} /></button>)}
      <Link href={nl ? "/pricing" : "/en/pricing"} onMouseEnter={() => { if (!mobile) setOpen(null); }} onClick={close}>{nl ? "Prijzen" : "Pricing"}</Link>
      <Link href={languageHref} hrefLang={targetLang} lang={targetLang} className="sn-mobile-login" aria-label={languageLabel} onClick={close}>{nl ? "EN" : "NL"}</Link>
    </nav>
    <div className="sn-actions"><Link href={languageHref} hrefLang={targetLang} lang={targetLang} aria-label={languageLabel}>{nl ? "EN" : "NL"}</Link><Link href={`${DEFAULT_APP_ORIGIN}/login`} className="sn-login">{nl ? "Inloggen" : "Log in"}</Link><Link href="/contact" className="sn-contact">{nl ? "Kennismaken" : "Meet us"} <ArrowRight size={14} /></Link></div>
    <button className="sn-mobile-toggle" type="button" aria-expanded={mobile} aria-controls={`${id}-navigation`} aria-label={mobile ? (nl ? "Menu sluiten" : "Close menu") : (nl ? "Menu openen" : "Open menu")} onClick={() => { setMobile(!mobile); setOpen(null); }}>{mobile ? <X size={20} /> : <Menu size={20} />}</button>
    {open && <div ref={panel} id={`${id}-panel`} className={`sn-panel sn-panel--${open}`}>
      <div className="sn-simple-links">{companyLinks.map(item => <Link href={item.href} key={item.title} onClick={close}><strong>{item.title}<ArrowRight size={14} /></strong><small>{item.description}</small></Link>)}</div>
    </div>}
  </header>;
}
