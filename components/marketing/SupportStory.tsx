import { ArrowDown, ArrowUp, Check, FileText, Mail, Package, ShieldCheck } from "lucide-react";
import { Reveal } from "./Reveal";
import { SequenceMark } from "./SequenceMark";

export function SupportStory() {
  return (
    <div className="so-story" id="features">
      <Reveal as="section" className="so-intro"><span className="mk-section-kicker">GEMAAKT VOOR KLANTENSERVICE</span><h2>Meer context.<br /><span>Minder uitzoekwerk.</span></h2><p>Je mailbox brengt de klantvraag binnen. Jouw beleid helpt met het antwoord. Koppel je daarnaast een ondersteund verkoopkanaal, dan kan Support One ook beschikbare bestelgegevens erbij halen.</p></Reveal>

      <Reveal as="section" className="so-feature so-feature--order">
        <div className="so-feature-copy"><span className="so-label">01 / BESTELCONTEXT</span><h2>De bestelling erbij.<br />Het zoekwerk eraf.</h2><p>Met een gekoppeld verkoopkanaal gebruikt Support One de beschikbare bestel- en verzendgegevens bij een klantvraag. Voor bol kan dit al; Shopify is onze eerste pilot. Zonder koppeling blijft de actuele bestelstatus onbekend.</p><a href="#voorbeelden" className="mk-text-link">Bekijk het in de demo <ArrowUp size={15} /></a></div>
        <div className="so-visual so-order-visual" aria-label="Voorbeeld van bestelcontext"><div className="so-floating-question"><Mail size={17} /><span>“Waar blijft mijn bestelling?”</span></div><div className="so-order-card"><div className="so-card-heading"><div className="so-icon"><Package size={21} /></div><div><strong>Bestelling #4521</strong><small>Voorbeeld · bol</small></div><span className="so-state">Onderweg</span></div><div className="so-shipping-track"><span className="is-done"><Check size={12} /></span><i /><span className="is-done"><Check size={12} /></span><i /><span /></div><div className="so-track-labels"><span>Besteld</span><span>Verzonden</span><span>Bezorgd</span></div><div className="so-order-note"><span>Bezorgmoment</span><strong>Nog niet bevestigd</strong></div><p>Antwoord op basis van wat bekend is.</p></div></div>
      </Reveal>

      <Reveal as="section" className="so-feature so-feature--reverse">
        <div className="so-feature-copy"><span className="so-label">02 / JOUW KENNIS</span><h2>Jouw beleid.<br />In ieder concept.</h2><p>Voeg je retourbeleid, verzendinformatie en productkennis toe. Support One gebruikt relevante passages om een antwoord voor te bereiden dat bij jouw bedrijf past.</p></div>
        <div className="so-visual so-knowledge-visual" aria-label="Illustratie van bedrijfskennis als context"><div className="so-document"><div className="so-card-heading"><FileText size={20} /><strong>Retourbeleid</strong><small>Voorbeeld</small></div><div className="so-text-lines"><i /><i /></div><blockquote>Je kunt je retour binnen <mark>30 dagen na ontvangst</mark> aanmelden.</blockquote><div className="so-text-lines"><i /><i /></div></div><div className="so-context-link"><ArrowDown size={18} /><span>Context voor het antwoord</span></div><div className="so-knowledge-answer"><SequenceMark size={32} title="" /><p>“Volgens ons retourbeleid kun je je retour binnen 30 dagen aanmelden…”</p></div></div>
      </Reveal>

      <Reveal as="section" className="so-feature so-control">
        <div className="so-feature-copy"><span className="so-label">03 / MENSELIJKE CONTROLE</span><h2>Support One bereidt voor.<br />Jij beslist.</h2><p>Lees het concept, pas het aan of neem de vraag zelf over. Je begint met menselijke goedkeuring. Automatisch versturen stel je later bewust in, met je eigen voorwaarden en verzendmomenten.</p><span className="so-inline-proof"><ShieldCheck size={18} /> Menselijke controle is de standaard</span></div>
        <div className="so-control-scene"><div className="so-review-bubble"><span className="so-status-dot" /> Concept klaar voor jouw controle<Check size={17} /></div><div className="so-control-mascot"><SequenceMark size={380} state="idle" followPointer={520} title="Support-assistent met headset" /></div></div>
      </Reveal>

      <div className="so-feature-pair">
        <Reveal as="article" className="so-small-feature"><span className="so-label">04 / ANTWOORDSTIJL</span><h2>Maak van een correctie<br />een duidelijke afspraak.</h2><p>Support One kan verbeteringen voorstellen op basis van aanpassingen aan antwoorden. Jij bepaalt welke afspraken actief worden.</p><div className="so-rule-demo"><span className="so-label">VOORBEELD VAN EEN LEERVOORSTEL</span><p><s>Geachte klant,</s><span>Hoi Sanne,</span></p><div><FileText size={17} /><span>Spreek klanten aan met hun voornaam.</span><span className="so-state">Ter beoordeling</span></div></div></Reveal>
        <Reveal as="article" className="so-small-feature" delay={100}><span className="so-label">05 / JE BESTAANDE MAILBOX</span><h2>Geen nieuwe helpdesk.<br />Gewoon je eigen supportadres.</h2><p>Of je nu op bol, Shopify of WooCommerce verkoopt: klantvragen die in je gekoppelde mailbox binnenkomen, kan Support One voorbereiden. Je webshop koppel je apart voor actuele bestelgegevens.</p><div className="so-mail-route"><div><Mail size={22} /><strong>Jouw mailbox</strong><small>Inkomende klantvraag</small></div><span aria-hidden>→</span><div><SequenceMark size={42} title="" /><strong>Support One</strong><small>Concept ter controle</small></div></div><p className="so-small-note">Ontvangen via forwarding of IMAP · versturen via SMTP</p></Reveal>
      </div>

      <Reveal as="section" className="so-feature so-insights"><div className="so-feature-copy"><span className="so-label">06 / INZICHT</span><h2>Herken de vragen<br />achter de drukte.</h2><p>Bekijk volume, onderwerpen en knelpunten in je support. Zo zie je welke vragen terugkomen en waar duidelijkere informatie je klanten kan helpen.</p><span className="so-inline-proof">Van antwoorden geven naar beter begrijpen.</span></div><div className="so-visual so-chart"><div className="so-chart-title"><strong>Waar gaan de vragen over?</strong><small>Illustratieve verdeling</small></div>{[{name:"Bezorging",width:82},{name:"Retouren",width:54},{name:"Productinformatie",width:33}].map(item => <div className="so-chart-row" key={item.name}><span>{item.name}</span><div><i style={{width:`${item.width}%`}} /></div></div>)}<p>Ontdek terugkerende onderwerpen in je inbox.</p></div></Reveal>
    </div>
  );
}
