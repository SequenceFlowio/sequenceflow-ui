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
};

/** Vervangt losse regels `::figure[naam]` door de bijbehorende figuur. */
export function figureHtml(name: string) {
  const figure = BLOG_FIGURES[name];
  if (!figure) return "";
  return `<figure class="mk-figure">${figure.svg}<figcaption>${figure.caption}</figcaption></figure>`;
}
