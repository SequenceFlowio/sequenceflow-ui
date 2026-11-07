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

export function SiteNavigation() {
  const [open, setOpen] = useState<Section | null>(null);
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<Section, HTMLButtonElement | null>>>({});
  const id = useId();
  const pathname = usePathname();
  // EN gaat naar dezelfde pagina in het Engels; /en is de Engelse Support One-pagina.
  const englishHref = pathname === "/pricing" ? "/en/pricing" : "/en";

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
    <a className="so-skip" href="#main-content">Naar de inhoud</a>
    <Link href="/" className="sn-logo" aria-label="SequenceFlow home"><Image src="/logo-white.png" alt="SequenceFlow" width={188} height={46} priority /></Link>
    <nav id={`${id}-navigation`} className={`sn-nav${mobile ? " is-open" : ""}`} aria-label="Hoofdnavigatie">
      <a href="/support-one#functies" onMouseEnter={() => { if (!mobile) setOpen(null); }} onClick={close}>Wat het doet</a>
      {SECTIONS.map(([section, label]) => <button type="button" key={section} ref={node => { triggers.current[section] = node; }} aria-expanded={open === section} aria-controls={`${id}-panel`} onMouseEnter={() => { if (!mobile) setOpen(section); }} onClick={() => setOpen(mobile && open === section ? null : section)} onKeyDown={event => {
        if (event.key === "ArrowDown") {
          event.preventDefault(); setOpen(section);
          requestAnimationFrame(() => panel.current?.querySelector<HTMLAnchorElement>("a")?.focus());
        }
      }}>{label}<ChevronDown size={12} /></button>)}
      <Link href="/pricing" onMouseEnter={() => { if (!mobile) setOpen(null); }} onClick={close}>Prijzen</Link>
      <Link href={englishHref} hrefLang="en" lang="en" className="sn-mobile-login" onClick={close}>English</Link>
    </nav>
    <div className="sn-actions"><Link href={englishHref} hrefLang="en" lang="en" aria-label="English">EN</Link><Link href={`${DEFAULT_APP_ORIGIN}/login`} className="sn-login">Inloggen</Link><Link href="/contact" className="sn-contact">Kennismaken <ArrowRight size={14} /></Link></div>
    <button className="sn-mobile-toggle" type="button" aria-expanded={mobile} aria-controls={`${id}-navigation`} aria-label={mobile ? "Menu sluiten" : "Menu openen"} onClick={() => { setMobile(!mobile); setOpen(null); }}>{mobile ? <X size={20} /> : <Menu size={20} />}</button>
    {open && <div ref={panel} id={`${id}-panel`} className={`sn-panel sn-panel--${open}`}>
      <div className="sn-simple-links">{LINKS[open].map(item => <Link href={item.href} key={item.title} onClick={close}><strong>{item.title}<ArrowRight size={14} /></strong><small>{item.description}</small></Link>)}</div>
    </div>}
  </header>;
}
