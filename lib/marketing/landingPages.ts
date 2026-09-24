export type LandingPageContent = {
  slug: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  /** Alleen voor doelgroeppagina's; de algemene pagina vertelt dit via het productverhaal. */
  painTitle?: string;
  pains?: Array<{ title: string; description: string }>;
  outcomeTitle?: string;
  outcomes?: string[];
  faq: Array<{ question: string; answer: string }>;
};

export const LANDING_PAGES: Record<string, LandingPageContent> = {
  general: {
    slug: "general",
    eyebrow: "AI-klantenservice voor e-commerce",
    title: "Je AI-collega",
    accent: "voor de supportinbox.",
    description: "Koppel je supportmailbox en laat Support One antwoorden voorbereiden met jouw bedrijfskennis. Met een webshopkoppeling kan ook actuele bestelcontext worden meegenomen. Jij beslist wat er wordt verstuurd.",
    primaryCta: "Start 14 dagen gratis",
    secondaryCta: "Bekijk een voorbeeld",
    faq: [
      { question: "Werkt Support One met Shopify of WooCommerce?", answer: "Ja, voor klantvragen die via je gekoppelde supportmailbox binnenkomen. Zonder aparte webshopkoppeling kan Support One nog geen actuele Shopify- of WooCommerce-bestelstatus ophalen. De bol-koppeling voor bestelcontext is beschikbaar; Shopify testen we eerst met een pilotklant, daarna WooCommerce." },
      { question: "Waarom zijn er twee koppelingen?", answer: "Je mailbox ontvangt klantvragen en verstuurt antwoorden. Een webshopkoppeling is een afzonderlijke, optionele bron voor actuele bestelgegevens. Zonder die extra koppeling gebruikt Support One de vraag en jouw bedrijfskennis, maar verzint het geen bestelstatus." },
      { question: "Voert Support One retouren of terugbetalingen uit?", answer: "Support One helpt je team met antwoordconcepten en beschikbare context. Het voert op dit moment geen retouren, annuleringen of terugbetalingen uit in je webshop." },
      { question: "Verstuurt Support One direct automatisch?", answer: "Niet standaard. Nieuwe accounts starten met menselijke goedkeuring. Automatisch versturen is optioneel, zit in Growth en Scale, en vraagt bij het aanzetten om een expliciete bevestiging. Je stelt zelf in hoe zeker Support One moet zijn en wanneer er verstuurd wordt." },
      { question: "Werkt het met onze huidige mailbox?", answer: "Je kunt inkomende mail koppelen via forwarding of IMAP en uitgaande antwoorden via SMTP instellen. De benodigde stappen verschillen per mailprovider. Bij Gmail kan bijvoorbeeld een appwachtwoord nodig zijn." },
      { question: "Worden onze mails gebruikt om modellen te trainen?", answer: "Nee. E-mailinhoud wordt uitsluitend verwerkt om de dienst te leveren en wordt via de API niet gebruikt om OpenAI-modellen te trainen." },
    ],
  },
  webshops: {
    slug: "webshops",
    eyebrow: "Voor groeiende webshops",
    title: "Beantwoord webshopvragen voordat ze",
    accent: "omzet en vertrouwen kosten.",
    description: "Van ‘waar blijft mijn bestelling?’ tot retouren en beschadigde producten: Support One zet een onderbouwd antwoord klaar met jouw beleid als bron.",
    primaryCta: "Probeer het met je eigen inbox",
    secondaryCta: "Bekijk een voorbeeld",
    painTitle: "Dezelfde vragen. Elke dag. Toch verdient elke klant een goed antwoord.",
    pains: [
      { title: "Bestelstatus", description: "Herken terugkerende verzendvragen en maak direct een duidelijk, behulpzaam concept." },
      { title: "Retouren en garantie", description: "Antwoorden volgen je eigen voorwaarden in plaats van algemene AI-aannames." },
      { title: "Piekdrukte", description: "Vang campagnes, feestdagen en groeispurten op zonder iedere piek met extra handwerk te betalen." },
    ],
    outcomeTitle: "Voor webshops waar support onderdeel is van de klantbeleving, niet alleen een kostenpost.",
    outcomes: ["Sneller reageren op koop- en bestelvragen", "Consistente toepassing van retourbeleid", "Minder repetitief werk voor oprichters en teams", "Inzicht in terugkerende klantproblemen"],
    faq: [
      { question: "Moeten we overstappen van e-mailprovider?", answer: "Nee. Support One werkt met je bestaande supportmailbox via forwarding of IMAP en kan antwoorden via je eigen SMTP-instellingen verzenden." },
      { question: "Kan de AI ons retourbeleid kennen?", answer: "Ja. Upload je beleid, FAQ's en productinformatie als kennisdocumenten. Support One gebruikt die context bij elk relevant concept." },
      { question: "Is dit ook geschikt voor een kleine webshop?", answer: "Ja. Starter is bedoeld voor webshops tot zo'n 50 bestellingen per dag en bevat 100 antwoordconcepten per maand, twee teamleden en 25 kennisdocumenten." },
    ],
  },
  "customer-service-teams": {
    slug: "customer-service-teams",
    eyebrow: "Voor customer-service teams",
    title: "Van volle supportinbox naar een",
    accent: "controleerbare AI-workflow.",
    description: "Laat AI classificeren en schrijven, terwijl je team uitzonderingen, tone of voice en gevoelige antwoorden onder controle houdt.",
    primaryCta: "Start met mijn team",
    secondaryCta: "Bekijk een voorbeeld",
    painTitle: "Automatisering die agents helpt in plaats van buitenspel zet.",
    pains: [
      { title: "Eén werkwijze", description: "Leg antwoordstijl, escalaties en bedrijfsregels vast zodat concepten consistenter worden." },
      { title: "Mens bij uitzonderingen", description: "Lage zekerheid en gevoelige vragen blijven zichtbaar voor beoordeling." },
      { title: "Meetbare kwaliteit", description: "Zie volumes, intenties, auto-send resultaten en terugkerende pijnpunten in één overzicht." },
    ],
    outcomeTitle: "Meer capaciteit per agent, met een duidelijk controlepunt voor je merk en beleid.",
    outcomes: ["Gedeelde kennis voor het hele team", "Rollen voor admins en agents", "Escalatie naar het juiste interne team", "Inplannen en automatisch versturen vanaf Growth"],
    faq: [
      { question: "Kunnen agents concepten aanpassen?", answer: "Ja. Agents kunnen het originele antwoord beoordelen en bewerken voordat het wordt verzonden." },
      { question: "Kunnen we auto-send beperken?", answer: "Ja. Automatisch versturen is optioneel, zit in Growth en Scale, en werkt met een instelbare drempel en vaste verzendmomenten. Twijfelt Support One, dan blijft het antwoord altijd ter beoordeling." },
      { question: "Hoeveel teamleden zijn inbegrepen?", answer: "Starter bevat twee teamleden, Growth vijf en Scale onbeperkt. De limiet wordt bij uitnodigen technisch afgedwongen." },
    ],
  },
  "ecommerce-founders": {
    slug: "ecommerce-founders",
    eyebrow: "Voor e-commerce founders",
    title: "Stop met zelf iedere klantmail",
    accent: "tussen je andere werk door te beantwoorden.",
    description: "Support One maakt supportantwoorden klaar op basis van jouw regels, zodat jij alleen nog beslist waar menselijke aandacht echt nodig is.",
    primaryCta: "Start 14 dagen gratis",
    secondaryCta: "Bekijk een voorbeeld",
    painTitle: "Je hoeft geen supportafdeling te bouwen om professioneel te antwoorden.",
    pains: [
      { title: "Rust in je dag", description: "Open niet steeds opnieuw je mailbox voor dezelfde bestel-, retour- en productvragen." },
      { title: "Jouw regels blijven leidend", description: "Upload wat je belooft aan klanten en laat concepten daarop aansluiten." },
      { title: "Groeien zonder supportachterstand", description: "Maak eerst het repetitieve werk schaalbaar en voeg later teamleden toe wanneer dat echt nodig is." },
    ],
    outcomeTitle: "Een professionele supportflow zonder dat jij de hele dag supportmedewerker hoeft te zijn.",
    outcomes: ["Duidelijke onboardingstappen", "Geen creditcard voor de proefperiode", "Start met goedkeuring, automatiseer later", "Eén plek voor inbox, kennis en inzichten"],
    faq: [
      { question: "Hoe snel kan ik starten?", answer: "Na inloggen koppel je je mailbox, upload je relevante kennis en test je de afzender. De onboarding laat precies zien welke stappen nog nodig zijn." },
      { question: "Heb ik technische kennis nodig?", answer: "Niet voor forwarding. Voor IMAP en SMTP heb je de servergegevens van je mailprovider nodig; Support One bevat presets en verbindingstests." },
      { question: "Kan ik eerst alles controleren?", answer: "Ja. Handmatige goedkeuring is de standaard. Je bepaalt zelf of en wanneer je later auto-send activeert." },
    ],
  },
};
