/**
 * SequenceFlow Brand Brain voor Instagram.
 * Vervangt de Noctis-kennisbank. Alles wat de tekst- en beeldgenerator over
 * het merk, de doelgroep en de contentstrategie moet weten staat hier.
 */

export const BRAND = {
  name: "SequenceFlow",
  handle: "@sequenceflow.io",
  website: "sequenceflow.io",
  mission: "Ondernemers hun tijd teruggeven door werk slimmer in te richten.",
  stance: "Wij staan voor optimalisatie: minder handwerk, betere systemen, meer focus op wat groei oplevert.",
  products: [
    { name: "Support One", what: "AI-collega voor klantenservice: maakt antwoordconcepten voor klantmails op basis van het eigen beleid; de ondernemer keurt goed." },
    { name: "Content One", what: "AI-contentgenerator die van webshopproducten social posts maakt en een contentkalender vult (early access)." },
  ],
} as const;

export const AUDIENCE = {
  who: "E-commerce-ondernemers in Nederland en België: webshophouders (Shopify, WooCommerce, Lightspeed), verkopers op bol en e-commerce founders met kleine teams (1–15 mensen).",
  pains: [
    "Te veel ballen tegelijk hoog houden, de dag wordt geleefd door de inbox",
    "Steeds dezelfde vragen en taken die handmatig gebeuren",
    "Geen tijd om aan het bedrijf te werken in plaats van erin",
    "Moeite met loslaten en delegeren",
    "Versnipperde tools, losse spreadsheets, kennis die alleen in het hoofd van de eigenaar zit",
    "Weinig rust: avonden en weekenden gaan op aan 'nog even snel'",
    "Marges onder druk door verzendkosten, retouren, advertentiekosten en kortingsacties",
    "Nieuwe regels en platformwijzigingen bijhouden naast het dagelijkse werk",
  ],
  wants: [
    "Concrete, direct toepasbare tips die vandaag nog tijd opleveren",
    "Systemen en gewoontes die blijven werken als het drukker wordt",
    "Overzicht in cijfers zonder urenlang rapporten bouwen",
    "Weten welke nieuwe regels en platformupdates voor hun webshop gelden, en wat ze moeten doen",
  ],
} as const;

export interface ContentPillar {
  id: string;
  name: string;
  goal: string;
  angles: string[];
  weight: number; // relatieve frequentie
  promo?: boolean;
}

export const PILLARS: ContentPillar[] = [
  {
    id: "tijd",
    name: "Tijd terugwinnen",
    goal: "Praktische timemanagement-technieken voor ondernemers.",
    angles: ["time blocking", "taken batchen", "de 2-minutenregel", "weekplanning op vrijdag", "nee zeggen", "energie-uren benutten"],
    weight: 2,
  },
  {
    id: "systemen",
    name: "Systemen & automatisering",
    goal: "Herhaalwerk vastleggen en automatiseren, tool-agnostisch.",
    angles: ["SOP's in 15 minuten", "templates voor terugkerende mails", "checklists", "automatiseren wat je 3x per week doet", "één bron van waarheid", "AI als eerste concept, mens als eindredacteur"],
    weight: 2,
  },
  {
    id: "focus",
    name: "Focus & deep work",
    goal: "Minder afleiding, meer gedaan krijgen in minder uren.",
    angles: ["meldingen uit", "inbox 2x per dag", "meeting-hygiëne", "single-tasking", "telefoon uit het zicht", "de belangrijkste taak eerst"],
    weight: 1,
  },
  {
    id: "delegeren",
    name: "Delegeren & loslaten",
    goal: "Werk overdragen zonder kwaliteitsverlies.",
    angles: ["wat moet jij écht doen", "taak overdragen met een Loom-video", "beslisregels in plaats van goedkeuring", "eerste hire", "virtuele assistent", "eigenaarschap geven"],
    weight: 1,
  },
  {
    id: "klantcontact",
    name: "Slim klantcontact",
    goal: "Klantenservice die schaalt zonder dat de ondernemer erin verdrinkt.",
    angles: ["top-10 vragen vooraf beantwoorden", "FAQ als tijdsbespaarder", "vaste antwoordblokken", "verwachtingen managen bij bezorging", "retourbeleid helder maken", "reactietijd en vertrouwen"],
    weight: 2,
  },
  {
    id: "cijfers",
    name: "Cijfers & beslissen",
    goal: "Sneller betere beslissingen met een paar kerncijfers.",
    angles: ["5 cijfers per week", "wekelijkse review van 30 minuten", "stoppen met wat niet werkt", "kosten per taak berekenen", "uurtje-factuurtje van je eigen tijd", "marge per order", "voorraad en dode voorraad", "kanalen vergelijken"],
    weight: 2,
  },
  {
    id: "webshop",
    name: "Webshop & conversie",
    goal: "Een webshop die beter verkoopt en minder vragen oproept: productpagina's, checkout, vertrouwen en de regels die daarbij horen.",
    angles: ["productpagina die vragen voorkomt", "productfoto's en maatinformatie", "checkout zonder drempels", "reviews en vertrouwen", "betaalmethodes", "laadsnelheid", "toegankelijkheid", "eerlijke kortingen"],
    weight: 3,
  },
  {
    id: "logistiek",
    name: "Verzending & retouren",
    goal: "Verzenden, levertijden en retouren slimmer regelen, zodat het minder geld en minder mails kost.",
    angles: ["gratis-verzendgrens", "wat een retour echt kost", "retouren voorkomen", "levertijd communiceren", "piekdrukte en laatste besteldag", "verpakking", "bedenktijd en terugbetalen"],
    weight: 2,
  },
  {
    id: "marketing",
    name: "E-mail, social & ads",
    goal: "Klanten vinden en terug laten komen zonder je marge weg te geven: e-mail, social, advertenties en meten.",
    angles: ["e-mail die aankomt", "herhaalaankopen", "kortingen vs. cadeaus", "seizoenscampagnes plannen", "meten met toestemming", "social content zonder elke dag te posten", "klantdata die je al hebt"],
    weight: 2,
  },
  {
    id: "mindset",
    name: "Ondernemersgewoontes",
    goal: "Gewoontes van ondernemers die rust en groei combineren — nuchter, geen hustle-cultuur.",
    angles: ["minder doen, beter doen", "een vast eindtijdstip", "plannen op energie", "pauzes die werken", "reflectie op vrijdag"],
    weight: 1,
  },
  {
    id: "product",
    name: "Achter de schermen",
    goal: "Af en toe laten zien hoe SequenceFlow zelf optimaliseert, met hooguit een zachte verwijzing naar Support One of Content One.",
    angles: ["hoe wij zelf onze klantmail inrichten", "wat AI wel en niet zou moeten doen", "controle vóór autonomie"],
    weight: 1,
    promo: true,
  },
];

/**
 * Contentformats: de vorm van een post, los van het onderwerp (de pijler).
 * De AI vult elk format creatief in; het label komt op de cover.
 * Formats met needsFacts mogen alleen over feiten uit NEWS gaan, nooit over iets verzonnens.
 */
export interface ContentFormat {
  id: string;
  name: string; // label op de cover
  goal: string;
  structure: string; // hoe de slides zijn opgebouwd
  weight: number;
  needsFacts?: boolean;
}

export const FORMATS: ContentFormat[] = [
  { id: "tips", name: "Tips & tricks", goal: "Een paar concrete tips rond één probleem.", structure: "Elke slide één tip: korte titel als opdracht, body met het hoe en waarom.", weight: 3 },
  { id: "regels", name: "Nieuwe regels", goal: "Een wet of regel die voor webshops geldt of gaat gelden, vertaald naar wat je moet doen.", structure: "Slide 1: wat er geldt en sinds/vanaf wanneer. Slide 2: voor wie. Slides daarna: wat je concreet aanpast. Sluit af met 'check bij twijfel je adviseur'.", weight: 1, needsFacts: true },
  { id: "platform", name: "Platform-update", goal: "Een wijziging bij een platform of dienst die webshops gebruiken (betalen, e-mail, advertenties, webshopsoftware) en wat je ermee doet.", structure: "Slide 1: wat er verandert. Slide 2: wat het voor jou betekent. Daarna: wat je nu doet. Neutraal, geen aanprijzing.", weight: 1, needsFacts: true },
  { id: "mythe", name: "Mythe of feit", goal: "Een hardnekkige aanname in e-commerce ontkrachten of nuanceren.", structure: "Slide 1: de mythe als stelling. Daarna: wat er echt speelt, een rekenvoorbeeld of nuance, en wat je wél doet.", weight: 2 },
  { id: "rekensom", name: "Rekensom", goal: "Een herkenbare beslissing doorrekenen met voorbeeldcijfers.", structure: "Slide 1: de vraag. Daarna: de aannames, de som stap voor stap, en de conclusie. Cijfers zijn altijd een voorbeeld, nooit onderzoek.", weight: 2 },
  { id: "fout", name: "Veelgemaakte fout", goal: "Een fout die webshops vaak maken, waarom die geld of tijd kost, en de oplossing.", structure: "Slide 1: de fout. Slide 2: wat het kost. Daarna: hoe je het oplost.", weight: 2 },
  { id: "checklist", name: "Checklist", goal: "Een korte checklist om nu af te lopen, vaak rond een moment (piekdrukte, feestdagen, jaarafsluiting).", structure: "Elke slide één controlepunt dat je kunt afvinken.", weight: 2 },
  { id: "praktijk", name: "Praktijkvoorbeeld", goal: "Een herkenbaar scenario van een (fictieve) webshop en hoe die het oplost.", structure: "Slide 1: de situatie. Daarna: wat ze veranderden en wat het opleverde. Maak duidelijk dat het een voorbeeld is, geen echte klant.", weight: 1 },
  { id: "vergelijk", name: "Dit of dat", goal: "Twee keuzes naast elkaar zetten zodat de lezer zelf kan kiezen.", structure: "Slide 1: optie A. Slide 2: optie B. Daarna: wanneer kies je wat.", weight: 1 },
  { id: "vraag", name: "Vraag & antwoord", goal: "Een vraag die ondernemers vaak stellen, eerlijk beantwoord.", structure: "Slide 1: de vraag. Daarna: het korte antwoord, de nuance en wat je doet.", weight: 1 },
];

export const formatName = (id?: string) => FORMATS.find((f) => f.id === id)?.name ?? id ?? "";

/**
 * Actuele feiten die de AI mag gebruiken voor 'Nieuwe regels', 'Platform-update' en seizoensposts.
 * De tekst-AI heeft geen internet: alleen wat hier staat mag als nieuws worden gebracht.
 * Houd dit bij (from/until bepalen wanneer een feit bruikbaar is).
 */
export interface NewsFact {
  id: string;
  kind: "regels" | "platform" | "seizoen";
  title: string;
  fact: string;
  action: string;
  from?: string; // yyyy-MM-dd: vanaf wanneer posten zinvol is
  until?: string; // yyyy-MM-dd: tot wanneer
}

export const NEWS: NewsFact[] = [
  { id: "herroepingsknop", kind: "regels", title: "Herroepingsknop verplicht", fact: "Sinds 19 juni 2026 moeten webshops een duidelijke herroepingsfunctie hebben: een knop of link waarmee de consument online de koop kan ontbinden, net zo makkelijk als bestellen (EU-richtlijn 2023/2673).", action: "Controleer of je webshop of retourportaal zo'n knop heeft, goed vindbaar is en een ontvangstbevestiging stuurt." },
  { id: "groene-claims", kind: "regels", title: "Strengere regels voor groene claims", fact: "Sinds 27 september 2026 zijn algemene milieuclaims zoals 'duurzaam', 'eco' of 'groen' zonder aantoonbaar bewijs verboden, net als eigen duurzaamheidslabels zonder erkende certificering (EU-richtlijn 2024/825).", action: "Loop productteksten, banners en labels na en vervang vage claims door specifieke, aantoonbare informatie." },
  { id: "toegankelijkheid", kind: "regels", title: "Toegankelijke webshop verplicht", fact: "Sinds 28 juni 2025 geldt de Europese toegankelijkheidswet (EAA) voor webshops: ze moeten bruikbaar zijn voor mensen met een beperking. Micro-ondernemingen (minder dan 10 medewerkers én maximaal €2 miljoen omzet) zijn voor diensten uitgezonderd.", action: "Check alt-teksten bij afbeeldingen, contrast, toetsenbordbediening en duidelijke foutmeldingen in de checkout." },
  { id: "gpsr", kind: "regels", title: "Productveiligheid online (GPSR)", fact: "Sinds 13 december 2024 moet een online productpagina onder de GPSR tonen: de fabrikant met contactgegevens, bij producten van buiten de EU een verantwoordelijke persoon in de EU, productidentificatie (type, batch of serienummer) en waarschuwingen of veiligheidsinformatie.", action: "Vul deze gegevens per product aan, ook bij dropshipping en bij verkoop via marktplaatsen." },
  { id: "van-prijs", kind: "regels", title: "Eerlijke kortingen (van-prijs)", fact: "Bij een prijsverlaging moet de 'van'-prijs de laagste prijs zijn die je in de 30 dagen ervoor hanteerde (Omnibus-richtlijn). De ACM controleert hier extra op rond Black Friday.", action: "Verhoog prijzen niet vlak voor een actie en leg je prijshistorie vast.", from: "2026-11-01", until: "2027-01-31" },
  { id: "reviews", kind: "regels", title: "Transparantie over reviews", fact: "Toon je reviews, dan moet je vermelden of en hoe je controleert dat ze van echte kopers komen. Nepreviews kopen of negatieve reviews verbergen is verboden (Omnibus-richtlijn).", action: "Zet bij je reviews een korte uitleg over hoe ze verzameld en gecontroleerd worden." },
  { id: "oss", kind: "regels", title: "Btw bij verkoop naar andere EU-landen", fact: "Verkoop je in totaal meer dan €10.000 per jaar aan consumenten in andere EU-landen, dan reken je de btw van het land van de klant en geef je die aan via de OSS-regeling.", action: "Houd je buitenlandse omzet per jaar bij en zet je btw-tarieven per land goed in je webshop." },
  { id: "bedenktijd", kind: "regels", title: "Bedenktijd en terugbetalen", fact: "De bedenktijd van 14 dagen begint op de dag dat de klant het product ontvangt. Na de melding moet je binnen 14 dagen terugbetalen, inclusief de standaard verzendkosten; je mag wachten tot het product terug is of de klant bewijst dat het is verzonden. Retourkosten mogen voor de klant zijn als je dat vooraf duidelijk meldt." , action: "Zet dit kort en helder op je retourpagina, zodat klanten het niet hoeven te vragen." },
  { id: "q4-btw", kind: "regels", title: "Btw-aangifte vierde kwartaal", fact: "Doe je per kwartaal btw-aangifte, dan moet de aangifte over oktober tot en met december uiterlijk 31 januari binnen zijn, en betaald.", action: "Plan in januari een vast blok voor je administratie en zet je voorraad op 31 december vast voor je jaarcijfers.", from: "2026-12-15", until: "2027-01-31" },
  { id: "bulk-mail", kind: "platform", title: "Strengere regels voor nieuwsbrieven", fact: "Gmail en Yahoo (sinds 2024) en Outlook (sinds 2025) eisen van grote verzenders SPF, DKIM en DMARC, een afmeldlink met één klik en weinig spammeldingen. Wie hier niet aan voldoet, belandt in spam of wordt geweigerd.", action: "Laat je domeininstellingen controleren en zorg voor een afmeldlink met één klik, vóór je grote campagnes." },
  { id: "consent-mode", kind: "platform", title: "Meten met toestemming (Consent Mode v2)", fact: "Sinds maart 2024 vraagt Google voor adverteren en meten in de EER om Consent Mode v2: de toestemmingskeuze uit je cookiebanner moet aan Google worden doorgegeven.", action: "Check of je cookiebanner Consent Mode v2 doorgeeft, anders mis je conversiedata en doelgroepen." },
  { id: "wero", kind: "platform", title: "iDEAL gaat op in Wero", fact: "iDEAL gaat de komende jaren stap voor stap over in Wero, het Europese betaalsysteem van banken. In checkouts verschijnt eerst 'iDEAL | Wero'.", action: "Vraag je betaalprovider wanneer en hoe de overstap voor jouw webshop gebeurt; meestal hoef je zelf weinig te doen." },
  { id: "platform-updates", kind: "platform", title: "Grote updates van je webshopsoftware", fact: "Webshopplatforms brengen regelmatig grote updates uit; Shopify bundelt ze twee keer per jaar in zijn Editions, vaak rond december en in de zomer.", action: "Lees de lijst, kies hooguit één of twee dingen die een echt probleem oplossen en test die eerst op een kopie van je thema." },
  { id: "black-friday", kind: "seizoen", title: "Black Friday en Cyber Monday", fact: "Black Friday valt dit jaar op 27 november 2026, Cyber Monday op 30 november 2026.", action: "Bereid kortingen, voorraad, klantenservice en verzendcapaciteit voor in plaats van alleen de actie.", from: "2026-11-01", until: "2026-12-01" },
  { id: "feestdagen", kind: "seizoen", title: "Sinterklaas en kerst", fact: "Sinterklaasavond is 5 december, Kerst 25 en 26 december. Klanten willen dan precies weten wat hun laatste besteldag is.", action: "Communiceer per vervoerder de laatste besteldag en je openingstijden van de klantenservice.", from: "2026-11-15", until: "2026-12-27" },
  { id: "januari-retouren", kind: "seizoen", title: "Retourpiek na de feestdagen", fact: "Na de feestdagen komen veel cadeaus retour, vaak via een andere persoon dan de koper.", action: "Maak duidelijk hoe een cadeau terug kan zonder bestelnummer van de koper, en wat je retourtermijn in deze periode is.", from: "2026-12-15", until: "2027-01-31" },
];

/** Feiten die bruikbaar zijn op een bepaalde datum. */
export function newsFor(date: string) {
  return NEWS.filter((n) => (!n.from || n.from <= date) && (!n.until || date <= n.until));
}

/**
 * Concurrenten van Support One en Content One: nooit aanprijzen of aanraden.
 * Platformnieuws (Shopify, WooCommerce) mag, maar alleen neutraal en niet over AI-klantenservice of AI-content.
 */
export const COMPETITOR_GUARD = {
  never: ["Shopify Inbox", "Shopify Sidekick", "Shopify Magic", "Gorgias", "Zendesk", "Freshdesk", "Intercom", "Tidio", "Trengo", "eDesk", "Richpanel", "Re:amaze", "Jasper", "Copy.ai"],
  rule: "Raad nooit tools of platformfuncties aan voor AI-klantenservice, chatbots, AI-teksten of AI-content, en noem bovenstaande producten niet. Over klantenservice en content geef je tool-onafhankelijke tips.",
};

/** Hooguit 1 op de 8 posts mag ons product noemen. */
export const PROMO_RATIO = 1 / 8;

export const VOICE = {
  personality: "Rustig, concreet, deskundig, nuchter. De ervaren collega die al heeft uitgezocht wat werkt.",
  rules: [
    "Schrijf in het Nederlands, je-vorm, korte zinnen.",
    "Elke post geeft één concreet inzicht dat de lezer vandaag kan toepassen.",
    "Begin met het probleem of de winst van de ondernemer, niet met ons.",
    "Gebruik cijfers alleen als voorbeeld of rekensom, nooit als verzonnen onderzoeksresultaat.",
    "Geen hustle-taal, geen schuldgevoel over handwerk.",
    "Noem SequenceFlow-producten alleen in de pijler 'Achter de schermen', en dan subtiel.",
    "Praat de taal van e-commerce: orders, marge, retouren, conversie, checkout, productpagina.",
    "Verzin nooit wetten, deadlines, bedragen of platformwijzigingen: nieuws en regels alleen uit de lijst met actuele feiten.",
  ],
  avoid: ["magisch", "game changer", "10x", "hustle", "grind", "nooit meer werken", "passief inkomen", "geheim", "hack je brein"],
  ctas: [
    "Bewaar deze post voor je volgende planningsmoment.",
    "Stuur door naar een ondernemer die dit nodig heeft.",
    "Welke pak jij als eerste aan? Laat het weten in de comments.",
    "Volg @sequenceflow.io voor wekelijks één optimalisatie.",
    "Probeer het deze week en kijk wat het je oplevert.",
  ],
  hashtags: ["#ondernemen", "#ondernemer", "#webshophouder", "#shopify", "#woocommerce", "#onlineverkopen", "#timemanagement", "#productiviteit", "#mkb", "#webshop", "#ecommerce", "#automatisering", "#ondernemerstips", "#efficientwerken", "#sequenceflow"],
};

/** Vaste beeldtaal, zodat de feed één geheel vormt. */
export const VISUAL_STYLE = {
  palette: "warm off-white canvas (#F7F7F2), deep ink black (#111711), one small lime-green accent (#C7F56F)",
  look: "calm editorial photography, soft natural daylight, shallow depth of field, minimal clutter, premium but approachable, Scandinavian-modern workspace aesthetic",
  rules: [
    "no text, letters, numbers, logos or watermarks anywhere in the image",
    "no recognizable brand products or app screens",
    "leave calm negative space in the upper third for a headline overlay",
    "people, if present, are seen from behind, cropped or out of focus — no direct faces",
  ],
};

export function brandBrief() {
  return [
    `Merk: ${BRAND.name} (${BRAND.website}). ${BRAND.mission} ${BRAND.stance}`,
    `Producten (alleen subtiel noemen in pijler 'Achter de schermen'): ${BRAND.products.map((p) => `${p.name} — ${p.what}`).join(" ")}`,
    `Doelgroep: ${AUDIENCE.who}`,
    `Pijnpunten: ${AUDIENCE.pains.join("; ")}`,
    `Wat ze willen: ${AUDIENCE.wants.join("; ")}`,
    `Stem: ${VOICE.personality}`,
    `Schrijfregels: ${VOICE.rules.join(" ")}`,
    `Vermijd deze woorden: ${VOICE.avoid.join(", ")}`,
    `Contentpijlers (onderwerp):\n${PILLARS.map((p) => `- ${p.id} (${p.name}): ${p.goal} Invalshoeken: ${p.angles.join(", ")}`).join("\n")}`,
    `Formats (vorm):\n${FORMATS.map((f) => `- ${f.id} (${f.name}): ${f.goal} Opbouw: ${f.structure}`).join("\n")}`,
    `Concurrenten, nooit noemen of aanraden: ${COMPETITOR_GUARD.never.join(", ")}. ${COMPETITOR_GUARD.rule}`,
  ].join("\n\n");
}

export function imagePromptFor(scene: string) {
  return [
    `Instagram photo for a productivity brand for entrepreneurs. Scene: ${scene}.`,
    `Style: ${VISUAL_STYLE.look}. Color palette: ${VISUAL_STYLE.palette}.`,
    `Rules: ${VISUAL_STYLE.rules.join("; ")}.`,
    "Portrait 3:4 composition, photorealistic, high detail.",
  ].join("\n");
}
