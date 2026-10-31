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
  who: "Drukke ondernemers in Nederland: webshophouders, e-commerce founders en eigenaren van kleine teams (1–15 mensen).",
  pains: [
    "Te veel ballen tegelijk hoog houden, de dag wordt geleefd door de inbox",
    "Steeds dezelfde vragen en taken die handmatig gebeuren",
    "Geen tijd om aan het bedrijf te werken in plaats van erin",
    "Moeite met loslaten en delegeren",
    "Versnipperde tools, losse spreadsheets, kennis die alleen in het hoofd van de eigenaar zit",
    "Weinig rust: avonden en weekenden gaan op aan 'nog even snel'",
  ],
  wants: [
    "Concrete, direct toepasbare tips die vandaag nog tijd opleveren",
    "Systemen en gewoontes die blijven werken als het drukker wordt",
    "Overzicht in cijfers zonder urenlang rapporten bouwen",
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
    weight: 3,
  },
  {
    id: "systemen",
    name: "Systemen & automatisering",
    goal: "Herhaalwerk vastleggen en automatiseren, tool-agnostisch.",
    angles: ["SOP's in 15 minuten", "templates voor terugkerende mails", "checklists", "automatiseren wat je 3x per week doet", "één bron van waarheid", "AI als eerste concept, mens als eindredacteur"],
    weight: 3,
  },
  {
    id: "focus",
    name: "Focus & deep work",
    goal: "Minder afleiding, meer gedaan krijgen in minder uren.",
    angles: ["meldingen uit", "inbox 2x per dag", "meeting-hygiëne", "single-tasking", "telefoon uit het zicht", "de belangrijkste taak eerst"],
    weight: 2,
  },
  {
    id: "delegeren",
    name: "Delegeren & loslaten",
    goal: "Werk overdragen zonder kwaliteitsverlies.",
    angles: ["wat moet jij écht doen", "taak overdragen met een Loom-video", "beslisregels in plaats van goedkeuring", "eerste hire", "virtuele assistent", "eigenaarschap geven"],
    weight: 2,
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
    angles: ["5 cijfers per week", "wekelijkse review van 30 minuten", "stoppen met wat niet werkt", "kosten per taak berekenen", "uurtje-factuurtje van je eigen tijd"],
    weight: 1,
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
  ],
  avoid: ["magisch", "game changer", "10x", "hustle", "grind", "nooit meer werken", "passief inkomen", "geheim", "hack je brein"],
  ctas: [
    "Bewaar deze post voor je volgende planningsmoment.",
    "Stuur door naar een ondernemer die dit nodig heeft.",
    "Welke pak jij als eerste aan? Laat het weten in de comments.",
    "Volg @sequenceflow.io voor wekelijks één optimalisatie.",
    "Probeer het deze week en kijk wat het je oplevert.",
  ],
  hashtags: ["#ondernemen", "#ondernemer", "#timemanagement", "#productiviteit", "#mkb", "#webshop", "#ecommerce", "#automatisering", "#ondernemerstips", "#efficientwerken", "#sequenceflow"],
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
    `Contentpijlers:\n${PILLARS.map((p) => `- ${p.id} (${p.name}): ${p.goal} Invalshoeken: ${p.angles.join(", ")}`).join("\n")}`,
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
