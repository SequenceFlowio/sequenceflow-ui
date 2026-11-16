/**
 * Illustraties voor de blog, als inline SVG in plaats van foto's: scherp op
 * elk scherm, licht, en in de huisstijl (zwart, limoen, wit). Gebruik in een
 * Markdown-post een losse regel `::figure[naam]`; blog.ts zet die om naar de
 * figuur hieronder. `cover: naam` in de front matter zet er een bovenaan de
 * post en op de kaart in het overzicht.
 *
 * Alle cijfers in de figuren zijn voorbeelden, geen onderzoek; het onderschrift
 * zegt dat ook. Kleuren komen uit CSS-variabelen (zie .mk-figure in marketing.css).
 */

type Figure = { svg: string; caption: string };

const LIME = "var(--fig-lime)";
const INK = "var(--fig-ink)";
const MUTED = "var(--fig-muted)";
const CARD = "var(--fig-card)";
const LINE = "var(--fig-line)";
const WARN = "#e08a5c";

const card = (x: number, y: number, w: number, h: number, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${CARD}" stroke="${LINE}" ${extra}/>`;
const text = (x: number, y: number, value: string, size = 13, fill = INK, weight = 600, anchor = "start") =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${value}</text>`;
const pill = (x: number, y: number, w: number, value: string, fill = LIME, color = "#142000") =>
  `<rect x="${x}" y="${y}" width="${w}" height="24" rx="12" fill="${fill}"/>${text(x + w / 2, y + 16, value, 11, color, 800, "middle")}`;
const svg = (body: string, height = 300) =>
  `<svg viewBox="0 0 640 ${height}" role="img" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">${body}</svg>`;

export const BLOG_FIGURES: Record<string, Figure> = {
  // Waar blijft mijn pakket: van vraag via bestelling naar antwoord.
  wismo: {
    caption: "Van klantvraag naar antwoord: de bestelling erbij, dan pas schrijven.",
    svg: svg(`
      ${card(24, 40, 180, 92)}${text(44, 70, "Klantvraag", 11, MUTED, 700)}${text(44, 96, "Waar blijft mijn", 15)}${text(44, 116, "pakket?", 15)}
      <path d="M212 86 H 248" stroke="${LIME}" stroke-width="2" stroke-dasharray="4 5"/><circle cx="252" cy="86" r="4" fill="${LIME}"/>
      ${card(260, 24, 156, 124)}${text(280, 54, "Bestelling #4521", 13)}
      <circle cx="288" cy="86" r="7" fill="${LIME}"/><rect x="296" y="84" width="40" height="4" fill="${LIME}"/><circle cx="344" cy="86" r="7" fill="${LIME}"/><rect x="352" y="84" width="40" height="4" fill="${LINE}"/><circle cx="398" cy="86" r="7" fill="none" stroke="${LINE}" stroke-width="3"/>
      ${text(280, 118, "Verzonden · PostNL", 12, MUTED, 600)}${text(280, 136, "Track &amp; trace bekend", 12, MUTED, 600)}
      <path d="M424 86 H 460" stroke="${LIME}" stroke-width="2" stroke-dasharray="4 5"/><circle cx="464" cy="86" r="4" fill="${LIME}"/>
      ${card(472, 40, 144, 92, `stroke="${LIME}"`)}${text(490, 70, "Antwoord", 11, LIME, 800)}${text(490, 96, "Onderweg, hier", 13)}${text(490, 115, "je track &amp; trace.", 13)}
      ${pill(232, 196, 176, "Jij keurt goed")}
      ${text(320, 258, "Geen belofte over een bezorgdag die de vervoerder niet gaf.", 12, MUTED, 500, "middle")}
    `),
  },

  // Rekensom: wat kost een klantmail.
  "mail-cost": {
    caption: "Rekenvoorbeeld met aangenomen cijfers. Vul je eigen getallen in.",
    svg: svg(`
      ${text(24, 40, "Voorbeeld: 40 klantmails per dag · 4 minuten per mail", 13, MUTED, 600)}
      ${card(24, 64, 186, 150)}${text(44, 98, "Per dag", 12, MUTED, 700)}${text(44, 140, "160 min", 30, INK, 700)}${text(44, 178, "≈ 2,7 uur", 14, MUTED, 600)}
      <path d="M220 139 H 242" stroke="${LINE}" stroke-width="2"/>
      ${card(250, 64, 186, 150)}${text(270, 98, "Per maand (22 dagen)", 12, MUTED, 700)}${text(270, 140, "≈ 59 uur", 30, INK, 700)}${text(270, 178, "dat is ruim 7 werkdagen", 14, MUTED, 600)}
      <path d="M446 139 H 468" stroke="${LINE}" stroke-width="2"/>
      ${card(476, 64, 140, 150, `stroke="${LIME}"`)}${text(496, 98, "× €30 per uur", 12, LIME, 800)}${text(496, 140, "≈ €1.760", 26, LIME, 700)}${text(496, 178, "per maand", 14, MUTED, 600)}
      ${text(320, 262, "Alleen de typtijd. Zoeken in je webshop en wisselen tussen tabbladen komt erbij.", 12, MUTED, 500, "middle")}
    `),
  },

  // Feestdagen: tijdlijn november–januari 2026.
  "peak-season": {
    caption: "De drukke weken van 2026 op een rij.",
    svg: svg(`
      <rect x="24" y="148" width="592" height="4" rx="2" fill="${LINE}"/>
      ${[
        [60, "27 nov", "Black Friday"],
        [176, "30 nov", "Cyber Monday"],
        [292, "5 dec", "Sinterklaas"],
        [408, "25–26 dec", "Kerst"],
        [540, "januari", "Retourpiek"],
      ].map(([x, date, label], index) => `
        <circle cx="${x}" cy="150" r="${index === 4 ? 9 : 11}" fill="${index === 4 ? "none" : LIME}" stroke="${LIME}" stroke-width="3"/>
        ${card(Number(x) - 54, index % 2 ? 176 : 48, 108, 70)}
        ${text(Number(x), (index % 2 ? 176 : 48) + 28, String(date), 12, LIME, 800, "middle")}
        ${text(Number(x), (index % 2 ? 176 : 48) + 50, String(label), 13, INK, 700, "middle")}`).join("")}
      ${text(320, 280, "Per moment: wat vragen klanten, en staat het antwoord al klaar?", 12, MUTED, 500, "middle")}
    `),
  },

  // Bedenktijd: 14 dagen na ontvangst, 14 dagen om terug te betalen.
  "return-window": {
    caption: "Bedenktijd en terugbetalen volgens de regels voor online verkoop.",
    svg: svg(`
      ${text(24, 40, "Dag 0 = de klant ontvangt het product", 13, MUTED, 600)}
      <rect x="24" y="78" width="280" height="44" rx="12" fill="${LIME}" opacity=".18" stroke="${LIME}"/>
      ${text(40, 106, "14 dagen bedenktijd", 15, LIME, 800)}
      <rect x="320" y="78" width="296" height="44" rx="12" fill="${CARD}" stroke="${LINE}"/>
      ${text(336, 106, "Melding gedaan: binnen 14 dagen terugbetalen", 13, INK, 700)}
      ${card(24, 150, 186, 92)}${text(44, 180, "Inclusief", 12, MUTED, 700)}${text(44, 206, "de standaard", 14)}${text(44, 226, "verzendkosten", 14)}
      ${card(227, 150, 186, 92)}${text(247, 180, "Je mag wachten", 12, MUTED, 700)}${text(247, 206, "tot het product terug", 14)}${text(247, 226, "is of bewijs van verzending", 13)}
      ${card(430, 150, 186, 92, `stroke="${LIME}"`)}${text(450, 180, "Sinds 19 juni 2026", 12, LIME, 800)}${text(450, 206, "online herroepen", 14)}${text(450, 226, "met een knop", 14)}
      ${text(320, 280, "Retourkosten mogen voor de klant zijn, als je dat vooraf duidelijk meldt.", 12, MUTED, 500, "middle")}
    `),
  },

  // Voorraad in dagen: verkoop per dag tegenover levertijd.
  "stock-days": {
    caption: "Voorbeeld: 30 stuks op voorraad, 5 per dag verkocht, 10 dagen levertijd.",
    svg: svg(`
      ${text(24, 40, "Voorraad linnen overhemd · M", 13, MUTED, 600)}
      <path d="M40 80 L 40 240 L 616 240" fill="none" stroke="${LINE}" stroke-width="2"/>
      <path d="M40 90 L 232 240" fill="none" stroke="${LIME}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="40" cy="90" r="6" fill="${LIME}"/>${text(52, 86, "30 stuks", 12, INK, 700)}
      <circle cx="232" cy="240" r="6" fill="#e08a5c"/>${text(232, 262, "dag 6: op", 12, "#e08a5c", 800, "middle")}
      <rect x="40" y="200" width="320" height="16" rx="8" fill="${CARD}" stroke="${LINE}"/>
      ${text(52, 212, "levertijd 10 dagen", 10, MUTED, 700)}
      <rect x="232" y="186" width="128" height="44" rx="10" fill="#e08a5c" opacity=".14"/>
      ${text(296, 180, "4 dagen niets te verkopen", 12, "#e08a5c", 800, "middle")}
      ${card(420, 76, 196, 104, `stroke="${LIME}"`)}${text(440, 106, "Bestel uiterlijk", 12, LIME, 800)}${text(440, 136, "vandaag", 24, INK, 700)}${text(440, 162, "6 dagen voorraad &lt; 10 dagen levertijd", 11, MUTED, 600)}
    `),
  },

  // Black Friday-actievoorwaarden: de vijf vragen die altijd komen.
  "bf-terms": {
    caption: "De vijf vragen over je actie die klanten het vaakst mailen.",
    svg: svg(`
      ${card(24, 28, 220, 244, `stroke="${LIME}"`)}
      ${text(44, 62, "BLACK FRIDAY", 12, LIME, 800)}${text(44, 104, "-25%", 46, INK, 800)}
      ${text(44, 140, "vr 27 nov – ma 30 nov", 13, MUTED, 600)}
      <rect x="44" y="162" width="180" height="1" fill="${LINE}"/>
      ${text(44, 190, "Actievoorwaarden", 13, INK, 700)}${text(44, 212, "in gewone taal,", 12, MUTED, 600)}${text(44, 232, "bovenaan de pagina", 12, MUTED, 600)}
      ${["Tot wanneer loopt het?", "Telt sale ook mee?", "Met een code stapelen?", "Kan ik retourneren?", "Wanneer verstuurd?"].map((label, index) => `
        ${card(272, 28 + index * 50, 344, 40)}
        <circle cx="294" cy="${48 + index * 50}" r="9" fill="${LIME}"/>${text(294, 52 + index * 50, String(index + 1), 11, "#142000", 800, "middle")}
        ${text(314, 53 + index * 50, label, 14, INK, 600)}`).join("")}
    `),
  },

  // Reactietijd: hoe de kans op een aankoop daalt met wachten (illustratief).
  "response-time": {
    caption: "Illustratie: hoe langer een klant wacht, hoe kleiner de kans dat hij nog bij jou koopt.",
    svg: svg(`
      ${text(24, 36, "Vraag vóór een aankoop: \"Valt deze maat klein?\"", 13, MUTED, 600)}
      <path d="M60 70 L 60 230 L 616 230" fill="none" stroke="${LINE}" stroke-width="2"/>
      ${[["1 uur", 150, LIME], ["4 uur", 120, LIME], ["1 dag", 78, "#e0c35c"], ["2 dagen", 40, WARN]].map(([label, height, color], index) => `
        <rect x="${100 + index * 130}" y="${230 - Number(height)}" width="76" height="${height}" rx="10" fill="${color}" opacity="${index < 2 ? 1 : 0.85}"/>
        ${text(138 + index * 130, 254, String(label), 13, INK, 700, "middle")}`).join("")}
      ${text(616, 92, "Kans op aankoop", 12, MUTED, 700, "end")}
      ${pill(432, 266, 184, "Doel: binnen 1 werkdag")}
    `),
  },

  // Standaardantwoorden: template met gaten tegenover een ingevuld concept.
  templates: {
    caption: "Een template laat de gaten open. Het werk zit in het invullen.",
    svg: svg(`
      ${card(24, 28, 280, 220)}${text(44, 58, "Template", 12, MUTED, 800)}
      ${text(44, 92, "Hoi [naam], je bestelling", 14)}${text(44, 116, "[nummer] is op [datum]", 14)}${text(44, 140, "verzonden met [vervoerder].", 14)}
      ${text(44, 172, "Track &amp; trace: [link]", 14)}
      ${["[naam]", "[nummer]", "[datum]", "[link]"].map((label, index) => pill(44 + index * 64, 206, 58, label, CARD, WARN)).join("")}
      <path d="M314 138 H 334" stroke="${LIME}" stroke-width="2" stroke-dasharray="4 5"/><circle cx="338" cy="138" r="4" fill="${LIME}"/>
      ${card(344, 28, 272, 220, `stroke="${LIME}"`)}${text(364, 58, "Concept van Seffy", 12, LIME, 800)}
      ${text(364, 92, "Hoi Sanne, je bestelling", 14)}${text(364, 116, "#4521 is op 24 nov", 14)}${text(364, 140, "verzonden met PostNL.", 14)}
      ${text(364, 172, "Track &amp; trace: postnl.nl/…", 14)}
      ${pill(364, 206, 150, "Klaar om te lezen")}
      ${text(320, 284, "Bestelling en beleid erbij gezocht; jij leest en verstuurt.", 12, MUTED, 500, "middle")}
    `),
  },

  // FAQ: van inbox naar top vijf vragen.
  faq: {
    caption: "Voorbeeld: tel een maand klantmails per onderwerp. De top vijf is je FAQ.",
    svg: svg(`
      ${text(24, 36, "Klantmails van één maand, per onderwerp", 13, MUTED, 600)}
      ${[["Bezorging &amp; afhaalpunt", 96], ["Retour &amp; ruilen", 74], ["Maat &amp; pasvorm", 58], ["Betalen &amp; achteraf", 32], ["Kortingscodes", 24], ["Overig", 12]].map(([label, value], index) => `
        ${text(24, 74 + index * 36, String(label), 13, index < 5 ? INK : MUTED, 600)}
        <rect x="210" y="${60 + index * 36}" width="${Number(value) * 3.6}" height="20" rx="6" fill="${index < 5 ? LIME : LINE}"/>
        ${text(218 + Number(value) * 3.6, 75 + index * 36, String(value), 12, MUTED, 700)}`).join("")}
      <rect x="16" y="54" width="608" height="178" rx="12" fill="none" stroke="${LIME}" stroke-dasharray="5 6" opacity=".55"/>
      ${pill(500, 270, 116, "= je FAQ")}
    `),
  },

  // Retourredenen.
  "return-reasons": {
    caption: "Veelvoorkomende retourredenen. De verhouding verschilt per webshop; het voorbeeld is illustratief.",
    svg: svg(`
      ${text(24, 36, "Waarom komt het terug?", 13, MUTED, 600)}
      ${[["Maat klopt niet", 38, true], ["Anders dan op de foto", 18, true], ["Kwaliteit valt tegen", 14, true], ["Beschadigd", 9, true], ["Te laat geleverd", 7, true], ["Spijt", 14, false]].map(([label, value, fixable], index) => `
        ${text(24, 74 + index * 36, String(label), 13, INK, 600)}
        <rect x="204" y="${60 + index * 36}" width="${Number(value) * 8}" height="20" rx="6" fill="${fixable ? LIME : LINE}"/>
        ${text(212 + Number(value) * 8, 75 + index * 36, `${value}%`, 12, MUTED, 700)}`).join("")}
      ${card(470, 120, 146, 92, `stroke="${LIME}"`)}${text(488, 150, "Te voorkomen", 12, LIME, 800)}${text(488, 178, "5 van 6", 22, INK, 700)}${text(488, 198, "oorzaken", 12, MUTED, 600)}
    `),
  },

  // Uitbesteden, zelf doen of AI.
  compare: {
    caption: "Drie manieren om je inbox te laten draaien, op hoofdlijnen vergeleken.",
    svg: svg(`
      ${[["Zelf doen", ["Kent je product", "Schaalt slecht", "Kost jouw avonden"], false], ["Uitbesteden", ["Schaalt goed", "Algemene antwoorden", "Kennis gaat de deur uit"], false], ["AI + jij beslist", ["Concept bij elke mail", "Jouw beleid en bestellingen", "Kennis blijft in huis"], true]].map(([title, points, best], index) => `
        ${card(24 + index * 200, 28, 184, 232, best ? `stroke="${LIME}"` : "")}
        ${text(44 + index * 200, 62, String(title), 15, best ? LIME : INK, 800)}
        ${(points as string[]).map((point, row) => `
          <circle cx="${50 + index * 200}" cy="${98 + row * 44}" r="6" fill="${best || row === 0 ? LIME : WARN}"/>
          ${text(64 + index * 200, 103 + row * 44, point, 12, INK, 600)}`).join("")}
        ${best ? pill(44 + index * 200, 222, 144, "Support One") : ""}`).join("")}
    `),
  },

  // Vertraging: tijdlijn met proactieve mail.
  delay: {
    caption: "Meld vertraging voordat de klant ernaar vraagt. Eén mail van jou voorkomt er drie van de klant.",
    svg: svg(`
      <rect x="40" y="128" width="560" height="4" rx="2" fill="${LINE}"/>
      ${[[70, "ma", "Besteld", LIME], [220, "di", "Vertraging bekend", WARN], [370, "wo", "Jij mailt de klant", LIME], [530, "vr", "Bezorgd", LIME]].map(([x, dayName, label, color]) => `
        <circle cx="${x}" cy="130" r="10" fill="${color}"/>
        ${text(Number(x), 104, String(dayName), 12, MUTED, 800, "middle")}
        ${text(Number(x), 162, String(label), 13, INK, 700, "middle")}`).join("")}
      ${card(250, 190, 240, 76, `stroke="${LIME}"`)}
      ${text(268, 216, "\"Je bestelling gaat een dag later", 12, INK, 600)}${text(268, 236, "de deur uit. Morgen krijg je de", 12, INK, 600)}${text(268, 256, "track &amp; trace.\"", 12, INK, 600)}
      <path d="M370 142 V 186" stroke="${LIME}" stroke-width="2" stroke-dasharray="4 5"/>
      ${text(24, 36, "Geen boze mail op donderdag", 13, MUTED, 600)}
    `),
  },

  // Onderwerpen in je inbox.
  topics: {
    caption: "Voorbeeld van een week klantmails rond Black Friday, per onderwerp.",
    svg: svg(`
      ${text(24, 36, "Week van Black Friday · 212 klantmails", 13, MUTED, 600)}
      ${(() => {
        const parts: Array<[string, number, string]> = [["Bezorging", 41, LIME], ["Actie &amp; codes", 22, "#9fd14f"], ["Retour", 17, "#6f9a35"], ["Maat", 11, "#4a6a24"], ["Overig", 9, LINE]];
        let x = 24;
        return parts.map(([label, value, color]) => {
          const w = value * 5.92;
          const out = `<rect x="${x}" y="64" width="${w - 4}" height="56" rx="10" fill="${color}"/>${value > 10 ? text(x + 12, 98, `${value}%`, 15, value > 15 ? "#142000" : INK, 800) : ""}${text(x + 2, 144, label, 12, INK, 700)}`;
          x += w;
          return out;
        }).join("");
      })()}
      ${card(24, 176, 592, 92, `stroke="${LIME}"`)}
      ${text(44, 206, "Wat wist de klant niet?", 12, LIME, 800)}
      ${text(44, 232, "Dat het pakket al onderweg was → verzendmail met track &amp; trace", 13)}
      ${text(44, 254, "Of de code op sale werkte → actievoorwaarden bovenaan", 13)}
    `),
  },

  // Laatste besteldag voor kerst.
  "xmas-deadline": {
    caption: "Rekenvoorbeeld: verzending binnen 1 werkdag, 2 werkdagen bezorging, 1 dag buffer.",
    svg: svg(`
      ${text(24, 36, "December 2026", 13, MUTED, 600)}
      ${["ma", "di", "wo", "do", "vr", "za", "zo"].map((name, index) => text(56 + index * 84, 66, name, 12, MUTED, 700, "middle")).join("")}
      ${[14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27].map((date, index) => {
        const col = index % 7;
        const row = Math.floor(index / 7);
        const x = 24 + col * 84;
        const y = 80 + row * 84;
        const deadline = date === 18;
        const eve = date === 24;
        const busy = date >= 21 && date <= 23;
        return `<rect x="${x}" y="${y}" width="72" height="72" rx="12" fill="${deadline ? LIME : CARD}" stroke="${eve ? LIME : LINE}" ${eve ? 'stroke-width="2"' : ""}/>
          ${text(x + 36, y + 32, String(date), 18, deadline ? "#142000" : INK, 800, "middle")}
          ${deadline ? text(x + 36, y + 54, "laatste dag", 10, "#142000", 800, "middle") : ""}
          ${eve ? text(x + 36, y + 54, "kerstavond", 10, LIME, 800, "middle") : ""}
          ${busy ? text(x + 36, y + 54, "onderweg", 10, MUTED, 700, "middle") : ""}`;
      }).join("")}
    `, 260),
  },

  // Boze klant: vijf stappen.
  tone: {
    caption: "Vijf stappen van een boze mail naar een rustige klant.",
    svg: svg(`
      ${card(24, 28, 592, 60)}${text(44, 64, "\"IK WACHT AL EEN WEEK!!! Dit is echt belachelijk.\"", 15, WARN, 700)}
      ${[["Lees", "de feiten"], ["Erken", "het probleem"], ["Geef", "de status"], ["Bied", "een keuze"], ["Sluit af", "met je naam"]].map(([verb, rest], index) => `
        ${card(24 + index * 120, 120, 108, 84, index === 4 ? `stroke="${LIME}"` : "")}
        ${text(78 + index * 120, 154, String(verb), 15, LIME, 800, "middle")}${text(78 + index * 120, 178, String(rest), 12, INK, 600, "middle")}
        ${index < 4 ? `<path d="M${134 + index * 120} 162 H ${142 + index * 120}" stroke="${LIME}" stroke-width="2"/>` : ""}`).join("")}
      ${text(320, 250, "Erkennen is geen schuld bekennen. Het laat zien dat je het hebt begrepen.", 12, MUTED, 500, "middle")}
    `, 280),
  },

  // Productpagina die vragen beantwoordt.
  "product-page": {
    caption: "Vijf vragen die een productpagina moet beantwoorden, voordat de klant ze mailt.",
    svg: svg(`
      ${card(24, 24, 250, 252)}
      <rect x="44" y="44" width="210" height="120" rx="10" fill="${LINE}"/>
      <path d="M100 140 L 140 92 L 170 124 L 190 106 L 230 140 Z" fill="${MUTED}" opacity=".5"/><circle cx="210" cy="78" r="12" fill="${MUTED}" opacity=".5"/>
      ${text(44, 192, "Regenjas Noor", 15)}${text(44, 214, "€ 129", 14, MUTED, 600)}
      <rect x="44" y="230" width="210" height="30" rx="15" fill="${LIME}"/>${text(149, 250, "In winkelwagen", 12, "#142000", 800, "middle")}
      ${[["Wat is het?", "Waterdicht, 10.000 mm, 680 g"], ["Past het?", "Valt normaal · maattabel in cm"], ["Hoe ziet het eruit?", "Daglichtfoto's, op schaal"], ["Wanneer heb ik het?", "Voor 16:00 besteld, morgen in huis"], ["Wat als het tegenvalt?", "30 dagen retour"]].map(([question, answer], index) => `
        <path d="M274 ${66 + index * 46} H 300" stroke="${LIME}" stroke-width="1.5" stroke-dasharray="3 4"/>
        ${card(304, 44 + index * 46, 312, 40)}
        ${text(320, 61 + index * 46, String(question), 11, LIME, 800)}${text(320, 77 + index * 46, String(answer), 12, INK, 600)}`).join("")}
    `),
  },

  // Uitverkocht: de vraag die je verkoopcijfers missen.
  waitlist: {
    caption: "Voorbeeld: na het uitverkopen zie je nul verkopen, maar de vraag staat nog in je inbox.",
    svg: svg(`
      ${text(24, 36, "Sneaker Lumi · maat 41", 13, MUTED, 600)}
      <path d="M40 60 L 40 220 L 616 220" fill="none" stroke="${LINE}" stroke-width="2"/>
      ${[8, 9, 7, 10, 9, 0, 0, 0, 0].map((value, index) => `<rect x="${60 + index * 60}" y="${220 - value * 14}" width="36" height="${value * 14}" rx="6" fill="${LIME}"/>`).join("")}
      ${[0, 0, 0, 0, 0, 6, 7, 5, 8].map((value, index) => (value ? `<rect x="${60 + index * 60}" y="${220 - value * 14}" width="36" height="${value * 14}" rx="6" fill="none" stroke="${LIME}" stroke-width="2" stroke-dasharray="4 4"/>` : "")).join("")}
      <path d="M352 56 V 224" stroke="${WARN}" stroke-width="2"/>${text(360, 70, "uitverkocht", 12, WARN, 800)}
      ${text(60, 246, "verkocht per week", 12, LIME, 700)}
      <rect x="220" y="236" width="14" height="14" rx="3" fill="none" stroke="${LIME}" stroke-dasharray="3 3"/>${text(240, 248, "klanten die ernaar vragen in je inbox", 12, MUTED, 700)}
      ${pill(470, 262, 146, "Otis telt dit mee")}
    `),
  },

  // AI-klantenservice: wat erin gaat en wie beslist.
  "ai-flow": {
    caption: "Een AI-antwoord is zo goed als wat erin gaat. En jij beslist wat eruit gaat.",
    svg: svg(`
      ${[["Klantmail", "\"Kan ik nog ruilen?\""], ["Jouw kennisbank", "Retour binnen 14 dagen"], ["Bestelling", "#4521 · bezorgd 20 nov"]].map(([title, value], index) => `
        ${card(24, 28 + index * 82, 196, 68)}${text(42, 54 + index * 82, String(title), 11, MUTED, 800)}${text(42, 78 + index * 82, String(value), 13)}
        <path d="M220 ${62 + index * 82} C 260 ${62 + index * 82}, 250 150, 292 150" fill="none" stroke="${LIME}" stroke-width="2" stroke-dasharray="4 5"/>`).join("")}
      <circle cx="320" cy="150" r="30" fill="${CARD}" stroke="${LIME}" stroke-width="2"/>${text(320, 155, "Seffy", 13, LIME, 800, "middle")}
      <path d="M352 150 H 392" stroke="${LIME}" stroke-width="2"/><circle cx="396" cy="150" r="4" fill="${LIME}"/>
      ${card(404, 92, 212, 116, `stroke="${LIME}"`)}${text(422, 120, "Concept", 11, LIME, 800)}${text(422, 146, "Ja, dat kan tot 4 dec.", 13)}${text(422, 166, "Meld je retour aan via …", 13)}
      ${pill(422, 176, 120, "Jij beslist")}
      ${text(320, 280, "Weet Seffy iets niet, dan verzint het niets en blijft de vraag bij jou.", 12, MUTED, 500, "middle")}
    `),
  },

  // Vijf KPI's.
  kpis: {
    caption: "Vijf cijfers zijn genoeg. Voorbeeldwaarden, geen benchmark.",
    svg: svg(`
      ${[["Mails per week", "184", "11 per 100 orders"], ["Reactietijd", "5 u", "langste: 2 dagen"], ["Top onderwerp", "Bezorging", "38% van de mails"], ["Mails per vraag", "1,6", "doel: onder 2"], ["Tijd per week", "9 u", "≈ €270 aan uren"]].map(([label, value, sub], index) => {
        const x = 24 + (index % 3) * 200;
        const y = index < 3 ? 28 : 156;
        return `${card(x, y, 184, 112, index === 2 ? `stroke="${LIME}"` : "")}${text(x + 18, y + 30, String(label), 11, MUTED, 800)}${text(x + 18, y + 68, String(value), 26, index === 2 ? LIME : INK, 700)}${text(x + 18, y + 94, String(sub), 12, MUTED, 600)}`;
      }).join("")}
      ${card(424, 156, 184, 112)}
      ${text(442, 186, "Eén keer per week", 12, LIME, 800)}${text(442, 212, "kijken, één ding", 13)}${text(442, 232, "verbeteren.", 13)}
    `),
  },

  // bol en webshop in één inbox.
  "bol-inbox": {
    caption: "Vragen uit bol en je eigen webshop in één inbox, met per vraag het kanaal erbij.",
    svg: svg(`
      ${card(24, 40, 170, 80)}${text(44, 72, "bol", 22, "#4d8df0", 800)}${text(44, 100, "verkopersaccount", 12, MUTED, 600)}
      ${card(24, 160, 170, 80)}${text(44, 192, "Webshop", 18, INK, 800)}${text(44, 220, "Shopify · WooCommerce", 12, MUTED, 600)}
      <path d="M194 80 C 236 80, 230 140, 266 140" fill="none" stroke="${LIME}" stroke-width="2" stroke-dasharray="4 5"/>
      <path d="M194 200 C 236 200, 230 140, 266 140" fill="none" stroke="${LIME}" stroke-width="2" stroke-dasharray="4 5"/>
      ${card(270, 28, 346, 224, `stroke="${LIME}"`)}${text(290, 58, "Eén inbox", 12, LIME, 800)}
      ${[["bol", "Wanneer wordt mijn bestelling geleverd?", "#4d8df0"], ["Webshop", "Kan ik maat L ruilen voor M?", LIME], ["bol", "Is dit product ook in het zwart?", "#4d8df0"]].map(([channel, question, color], index) => `
        <rect x="290" y="${76 + index * 56}" width="306" height="44" rx="10" fill="${CARD}" stroke="${LINE}"/>
        <rect x="302" y="${88 + index * 56}" width="64" height="20" rx="10" fill="${color}" opacity=".2"/>${text(334, 102 + index * 56, String(channel), 11, String(color), 800, "middle")}
        ${text(376, 102 + index * 56, String(question), 12, INK, 600)}`).join("")}
    `),
  },

  // Dode voorraad na de feestdagen.
  "dead-stock": {
    caption: "Illustratie: wie in december op het decembertempo inkoopt, houdt in februari voorraad over.",
    svg: svg(`
      ${text(24, 36, "Verkoop per week", 13, MUTED, 600)}
      <path d="M40 60 L 40 220 L 616 220" fill="none" stroke="${LINE}" stroke-width="2"/>
      ${[30, 34, 48, 72, 90, 84, 38, 26, 24, 22].map((value, index) => `<rect x="${58 + index * 56}" y="${220 - value * 1.6}" width="34" height="${value * 1.6}" rx="6" fill="${index >= 3 && index <= 5 ? LIME : "#6f9a35"}"/>`).join("")}
      <path d="M394 76 L 600 76" stroke="${WARN}" stroke-width="2" stroke-dasharray="6 5"/>${text(600, 68, "ingekocht op decembertempo", 12, WARN, 800, "end")}
      <rect x="394" y="76" width="206" height="100" fill="${WARN}" opacity=".1"/>${text(497, 132, "blijft liggen", 14, WARN, 800, "middle")}
      ${["nov", "dec", "jan", "feb"].map((month, index) => text(90 + index * 150, 246, month, 12, MUTED, 700, "middle")).join("")}
    `, 270),
  },

  // Shopify: van tabbladen wisselen naar één concept.
  shopify: {
    caption: "Zonder koppeling wissel je per mail tussen je inbox en Shopify. Met Support One staat de bestelling er al bij.",
    svg: svg(`
      ${text(24, 36, "Zonder koppeling", 12, MUTED, 800)}
      ${["Mail lezen", "Shopify openen", "Bestelling zoeken", "Status overnemen", "Antwoord typen"].map((label, index) => `${card(24 + index * 120, 50, 108, 52)}${text(78 + index * 120, 81, label, 11, INK, 700, "middle")}`).join("")}
      ${text(320, 128, "± 4 minuten per mail", 12, WARN, 800, "middle")}
      ${text(24, 168, "Met Support One", 12, LIME, 800)}
      ${card(24, 182, 230, 60)}${text(44, 210, "Mail lezen", 13)}${text(44, 230, "met bestelling #1084 erbij", 12, MUTED, 600)}
      <path d="M254 212 H 284" stroke="${LIME}" stroke-width="2"/>
      ${card(288, 182, 328, 60, `stroke="${LIME}"`)}${text(308, 210, "Concept lezen en versturen", 13)}${text(308, 230, "Shopify-status en jouw beleid al ingevuld", 12, MUTED, 600)}
      ${text(320, 276, "Rekenvoorbeeld; de tijdwinst hangt af van je eigen inbox.", 12, MUTED, 500, "middle")}
    `, 290),
  },

  // Vakantie: rooster tussen kerst en oud en nieuw.
  holiday: {
    caption: "Voorbeeld van een vakantieregeling: wat de klant ziet en wat er intussen gebeurt.",
    svg: svg(`
      ${text(24, 36, "24 december – 3 januari", 13, MUTED, 600)}
      ${[["24", false], ["25", false], ["26", false], ["27", false], ["28", true], ["29", false], ["30", true], ["31", false], ["1", false], ["2", false], ["3", false]].map(([date, ship], index) => `
        <rect x="${24 + index * 54}" y="54" width="46" height="56" rx="10" fill="${ship ? LIME : CARD}" stroke="${LINE}"/>
        ${text(47 + index * 54, 82, String(date), 15, ship ? "#142000" : INK, 800, "middle")}
        ${ship ? text(47 + index * 54, 100, "verzend", 9, "#142000", 800, "middle") : ""}`).join("")}
      ${card(24, 136, 288, 124)}${text(44, 164, "Wat de klant ziet", 12, LIME, 800)}
      ${text(44, 192, "Balk op je site", 13)}${text(44, 214, "Automatisch antwoord", 13)}${text(44, 236, "Regeling in je bevestigingsmail", 13)}
      ${card(328, 136, 288, 124, `stroke="${LIME}"`)}${text(348, 164, "Wat Seffy intussen doet", 12, LIME, 800)}
      ${text(348, 192, "Concept bij elke mail", 13)}${text(348, 214, "Jij leest 10 min per dag", 13)}${text(348, 236, "4 januari: geen berg", 13)}
    `, 280),
  },

  // Kennisbank: één plek.
  knowledge: {
    caption: "Eén kennisbank als bron voor jou, je team en de AI.",
    svg: svg(`
      ${[["Verzending", 40, 40], ["Retouren", 40, 120], ["Producten", 40, 200], ["Betalen", 470, 40], ["Acties", 470, 120], ["Toon", 470, 200]].map(([label, x, y]) => `
        ${card(Number(x), Number(y), 130, 56)}${text(Number(x) + 65, Number(y) + 34, String(label), 14, INK, 700, "middle")}
        <path d="M${Number(x) < 300 ? Number(x) + 130 : Number(x)} ${Number(y) + 28} L ${Number(x) < 300 ? 250 : 390} 148" stroke="${LINE}" stroke-width="2"/>`).join("")}
      <rect x="250" y="88" width="140" height="120" rx="18" fill="${CARD}" stroke="${LIME}" stroke-width="2"/>
      ${text(320, 138, "Kennisbank", 15, LIME, 800, "middle")}${text(320, 162, "één plek", 12, MUTED, 600, "middle")}
      ${pill(260, 232, 120, "Seffy leest mee")}
    `, 280),
  },

  // Jaar evalueren: zes vragen.
  "year-review": {
    caption: "Zes vragen om je webshopjaar af te sluiten.",
    svg: svg(`
      ${[["1", "Welke producten droegen je jaar?"], ["2", "Waar ging je tijd heen?"], ["3", "Welke vragen kwamen het vaakst?"], ["4", "Waar liep je voorraad mis?"], ["5", "Wat zeiden je klanten?"], ["6", "Wat pak je in januari aan?"]].map(([nr, label], index) => {
        const x = 24 + (index % 2) * 300;
        const y = 28 + Math.floor(index / 2) * 82;
        return `${card(x, y, 292, 68, index === 5 ? `stroke="${LIME}"` : "")}<circle cx="${x + 34}" cy="${y + 34}" r="16" fill="${index === 5 ? LIME : LINE}"/>${text(x + 34, y + 39, String(nr), 13, index === 5 ? "#142000" : INK, 800, "middle")}${text(x + 62, y + 39, String(label), 13, INK, 700)}`;
      }).join("")}
    `, 280),
  },
};

/** Vervangt losse regels `::figure[naam]` door de bijbehorende figuur. */
export function figureHtml(name: string) {
  const figure = BLOG_FIGURES[name];
  if (!figure) return "";
  return `<figure class="mk-figure">${figure.svg}<figcaption>${figure.caption}</figcaption></figure>`;
}
