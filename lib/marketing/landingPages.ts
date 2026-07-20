export type LandingPageContent = {
  slug: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  painTitle: string;
  pains: Array<{ title: string; description: string }>;
  outcomeTitle: string;
  outcomes: string[];
  faq: Array<{ question: string; answer: string }>;
};

export const LANDING_PAGES: Record<string, LandingPageContent> = {
  general: {
    slug: "general",
    eyebrow: "AI-klantenservice voor e-commerce",
    title: "Elke klantmail krijgt",
    accent: "snel een goed antwoord.",
    description: "SequenceFlow leest je supportmailbox, gebruikt je eigen beleid en maakt een passend antwoord klaar. Je team houdt controle; de wachtrij blijft bewegen.",
    primaryCta: "Start 14 dagen gratis",
    secondaryCta: "Bekijk hoe het werkt",
    painTitle: "Minder inboxwerk. Meer grip op elk antwoord.",
    pains: [
      { title: "Geen copy-paste antwoorden", description: "De AI combineert de klantvraag met je retour-, verzend- en productinformatie." },
      { title: "Geen black box", description: "Bekijk intentie, vertrouwen en concept voordat een antwoord wordt verzonden." },
      { title: "Geen nieuwe helpdesk nodig", description: "Koppel je bestaande mailbox via forwarding of IMAP en verstuur via je eigen adres." },
    ],
    outcomeTitle: "Gebouwd voor teams die sneller willen antwoorden zonder hun merkstem kwijt te raken.",
    outcomes: ["Concepten in de taal van de klant", "Kennisbank met eigen beleid", "Handmatige goedkeuring of gecontroleerde auto-send", "Analytics over volume, intenties en knelpunten"],
    faq: [
      { question: "Verstuurt SequenceFlow direct automatisch?", answer: "Niet standaard. Nieuwe accounts starten met menselijke goedkeuring. Auto-send is alleen beschikbaar op Pro en hoger en blijft instelbaar op vertrouwensniveau en verzendmoment." },
      { question: "Werkt het met onze huidige mailbox?", answer: "Ja. Je kunt inkomende mail koppelen via forwarding of IMAP. Uitgaande antwoorden kunnen via SMTP vanaf je eigen supportadres worden verzonden." },
      { question: "Worden onze mails gebruikt om modellen te trainen?", answer: "Nee. E-mailinhoud wordt uitsluitend verwerkt om de dienst te leveren en wordt via de API niet gebruikt om OpenAI-modellen te trainen." },
    ],
  },
  webshops: {
    slug: "webshops",
    eyebrow: "Voor groeiende webshops",
    title: "Beantwoord webshopvragen voordat ze",
    accent: "omzet en vertrouwen kosten.",
    description: "Van ‘waar blijft mijn bestelling?’ tot retouren en beschadigde producten: SequenceFlow zet een onderbouwd antwoord klaar met jouw beleid als bron.",
    primaryCta: "Automatiseer mijn support",
    secondaryCta: "Bekijk de workflow",
    painTitle: "Dezelfde vragen. Elke dag. Toch verdient elke klant een goed antwoord.",
    pains: [
      { title: "Bestelstatus", description: "Herken terugkerende verzendvragen en maak direct een duidelijk, behulpzaam concept." },
      { title: "Retouren en garantie", description: "Antwoorden volgen je eigen voorwaarden in plaats van algemene AI-aannames." },
      { title: "Piekdrukte", description: "Vang campagnes, feestdagen en groeispurten op zonder iedere piek met extra handwerk te betalen." },
    ],
    outcomeTitle: "Voor webshops waar support onderdeel is van de klantbeleving, niet alleen een kostenpost.",
    outcomes: ["Sneller reageren op koop- en bestelvragen", "Consistente toepassing van retourbeleid", "Minder repetitief werk voor oprichters en teams", "Inzicht in terugkerende klantproblemen"],
    faq: [
      { question: "Moeten we overstappen van e-mailprovider?", answer: "Nee. SequenceFlow werkt met je bestaande supportmailbox via forwarding of IMAP en kan antwoorden via je eigen SMTP-instellingen verzenden." },
      { question: "Kan de AI ons retourbeleid kennen?", answer: "Ja. Upload je beleid, FAQ's en productinformatie als kennisdocumenten. SequenceFlow gebruikt die context bij elk relevant concept." },
      { question: "Is dit ook geschikt voor een kleine webshop?", answer: "Ja. Starter is bedoeld voor kleine teams en bevat 250 verwerkte e-mails per maand, twee teamleden en 25 kennisdocumenten." },
    ],
  },
  "customer-service-teams": {
    slug: "customer-service-teams",
    eyebrow: "Voor customer-service teams",
    title: "Van volle supportinbox naar een",
    accent: "controleerbare AI-workflow.",
    description: "Laat AI classificeren en schrijven, terwijl je team uitzonderingen, tone of voice en gevoelige antwoorden onder controle houdt.",
    primaryCta: "Start met mijn team",
    secondaryCta: "Bekijk teamfuncties",
    painTitle: "Automatisering die agents helpt in plaats van buitenspel zet.",
    pains: [
      { title: "Eén werkwijze", description: "Leg antwoordstijl, escalaties en bedrijfsregels vast zodat concepten consistenter worden." },
      { title: "Mens bij uitzonderingen", description: "Lage zekerheid en gevoelige vragen blijven zichtbaar voor beoordeling." },
      { title: "Meetbare kwaliteit", description: "Zie volumes, intenties, auto-send resultaten en terugkerende pijnpunten in één overzicht." },
    ],
    outcomeTitle: "Meer capaciteit per agent, met een duidelijk controlepunt voor je merk en beleid.",
    outcomes: ["Gedeelde kennis voor het hele team", "Rollen voor admins en agents", "Escalatie naar het juiste interne team", "Planning en gecontroleerde auto-send vanaf Pro"],
    faq: [
      { question: "Kunnen agents concepten aanpassen?", answer: "Ja. Agents kunnen het originele antwoord beoordelen en bewerken voordat het wordt verzonden." },
      { question: "Kunnen we auto-send beperken?", answer: "Ja. Auto-send is optioneel, alleen beschikbaar op Pro en hoger, en werkt met een instelbare vertrouwensdrempel en vaste verzendvensters." },
      { question: "Hoeveel teamleden zijn inbegrepen?", answer: "Starter bevat twee teamleden, Pro vijf en Agency onbeperkt. De limiet wordt bij uitnodigen technisch afgedwongen." },
    ],
  },
  "ecommerce-founders": {
    slug: "ecommerce-founders",
    eyebrow: "Voor e-commerce founders",
    title: "Stop met zelf iedere klantmail",
    accent: "tussen je andere werk door te beantwoorden.",
    description: "SequenceFlow maakt supportantwoorden klaar op basis van jouw regels, zodat jij alleen nog beslist waar menselijke aandacht echt nodig is.",
    primaryCta: "Geef mijn inbox uit handen",
    secondaryCta: "Zie wat je bespaart",
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
      { question: "Heb ik technische kennis nodig?", answer: "Niet voor forwarding. Voor IMAP en SMTP heb je de servergegevens van je mailprovider nodig; SequenceFlow bevat presets en verbindingstests." },
      { question: "Kan ik eerst alles controleren?", answer: "Ja. Handmatige goedkeuring is de standaard. Je bepaalt zelf of en wanneer je later auto-send activeert." },
    ],
  },
};
