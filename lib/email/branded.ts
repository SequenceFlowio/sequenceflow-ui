/**
 * De ene huisstijl voor alle mails die SequenceFlow zelf verstuurt (affiliates,
 * inlogcodes, weekmails, meldingen). Niet voor antwoorden die Support One
 * namens een webshop aan diens klanten stuurt: dat is de mail van de webshop.
 *
 * Mailprogramma's lezen geen stylesheets of moderne CSS, dus alles is een
 * tabel met inline stijlen. Geen imports met een alias, zodat de tests dit
 * bestand kunnen laden. Elke mail heeft ook een tekstversie; die blijft de
 * bron, en `brandedFromText` maakt er de HTML-versie van.
 */

const SITE = "https://www.sequenceflow.io";
const LOGO = `${SITE}/logo-white.png`;

export const MAIL_COLORS = {
  page: "#0a0a0a",
  card: "#141414",
  inset: "#0f0f0f",
  line: "#262626",
  text: "#f5f5f5",
  muted: "#a1a1aa",
  lime: "#c7f56f",
  limeInk: "#11180a",
} as const;
const C = MAIL_COLORS;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export type MailBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; ordered?: boolean; items: Array<{ title: string; text?: string }> }
  | { type: "stats"; items: Array<{ label: string; value: string }> }
  | { type: "rows"; items: Array<{ label: string; value: string }> }
  | { type: "button"; label: string; href: string }
  | { type: "code"; value: string; caption?: string }
  | { type: "note"; text: string }
  | { type: "divider" };

export type BrandedMail = {
  /** Eerste regel die een mailprogramma naast het onderwerp toont. */
  preheader?: string;
  /** Klein label boven de titel, bijvoorbeeld "Affiliateprogramma" of "Otis · voorraad". */
  eyebrow?: string;
  title?: string;
  blocks: MailBlock[];
  /** Afsluiting, bijvoorbeeld "Team SequenceFlow" of "Seffy\nSupport One". */
  signature?: string;
  /** Kleine regels onder de kaart, bijvoorbeeld waarom je de mail krijgt of een afmeldlink. */
  footer?: string[];
  language?: "nl" | "en";
};

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const URL_PATTERN = /https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?]/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** Tekst veilig maken, met links en e-mailadressen klikbaar en regeleinden behouden. */
export function inline(text: string, color: string = C.lime) {
  // Lange links mogen afbreken, e-mailadressen niet.
  const link = (href: string, label: string) => `<a href="${escapeHtml(href)}" style="color:${color};text-decoration:underline;${href.startsWith("mailto:") ? "white-space:nowrap" : "word-break:break-word;overflow-wrap:anywhere"}">${escapeHtml(label)}</a>`;
  let out = "";
  let last = 0;
  const matches = [...text.matchAll(new RegExp(`${URL_PATTERN.source}|${EMAIL_PATTERN.source}`, "gi"))];
  for (const match of matches) {
    const index = match.index ?? 0;
    out += escapeHtml(text.slice(last, index));
    const value = match[0];
    out += value.startsWith("http") ? link(value, value.replace(/^https?:\/\/(www\.)?/, "")) : link(`mailto:${value}`, value);
    last = index + value.length;
  }
  out += escapeHtml(text.slice(last));
  return out.replace(/\n/g, "<br>");
}

const p = (html: string, style = "") => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.text};${style}">${html}</p>`;

function renderBlock(block: MailBlock): string {
  switch (block.type) {
    case "paragraph":
      return p(inline(block.text));
    case "heading":
      return `<h2 style="margin:28px 0 12px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">${escapeHtml(block.text)}</h2>`;
    case "note":
      return p(inline(block.text, C.muted), `font-size:13px;color:${C.muted}`);
    case "divider":
      return `<div style="height:1px;margin:24px 0;background:${C.line};line-height:1px;font-size:1px">&nbsp;</div>`;
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td style="border-radius:12px;background:${C.lime}"><a href="${escapeHtml(block.href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.limeInk};text-decoration:none;border-radius:12px">${escapeHtml(block.label)} &rarr;</a></td></tr></table>`;
    case "code":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px"><tr><td style="padding:16px 18px;border:1px solid ${C.line};border-radius:14px;background:${C.inset}">${block.caption ? `<div style="margin:0 0 6px;font-family:${FONT};font-size:12px;font-weight:600;color:${C.muted}">${escapeHtml(block.caption)}</div>` : ""}<div style="font-family:${MONO};font-size:${block.value.length <= 10 ? "28px;letter-spacing:.2em" : "15px"};font-weight:600;color:${C.lime};word-break:break-all">${inline(block.value)}</div></td></tr></table>`;
    case "list":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">${block.items.map((item, index) => `<tr><td valign="top" style="width:30px;padding:10px 0;border-top:1px solid ${index ? C.line : "transparent"}"><div style="width:22px;height:22px;border-radius:11px;background:${block.ordered === false ? "transparent" : C.lime};${block.ordered === false ? `border:1px solid ${C.lime};` : ""}text-align:center;font-family:${FONT};font-size:12px;font-weight:700;line-height:22px;color:${block.ordered === false ? C.lime : C.limeInk}">${block.ordered === false ? "&bull;" : index + 1}</div></td><td valign="top" style="padding:10px 0 10px 8px;border-top:1px solid ${index ? C.line : "transparent"};font-family:${FONT};font-size:15px;line-height:1.55;color:${C.text}"><div style="font-weight:600">${inline(item.title)}</div>${item.text ? `<div style="margin-top:3px;font-size:14px;color:${C.muted}">${inline(item.text, C.muted)}</div>` : ""}</td></tr>`).join("")}</table>`;
    case "stats": {
      // Twee per rij: past ook op een telefoon, waar mailprogramma's geen kolommen herschikken.
      const cells = block.items.slice(0, 4);
      const rows: Array<typeof cells> = [];
      for (let index = 0; index < cells.length; index += 2) rows.push(cells.slice(index, index + 2));
      const cell = (item: { label: string; value: string } | undefined) => item
        ? `<td valign="top" width="50%" style="padding:14px 16px 12px;border:1px solid ${C.line};border-radius:14px;background:${C.inset}"><div style="font-family:${FONT};font-size:22px;font-weight:600;color:${C.text};letter-spacing:-.01em">${escapeHtml(item.value)}</div><div style="margin-top:4px;font-family:${FONT};font-size:12px;line-height:1.35;color:${C.muted}">${escapeHtml(item.label)}</div></td>`
        : `<td width="50%"></td>`;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:separate;border-spacing:0 8px">${rows.map((row) => `<tr>${cell(row[0])}<td width="8" style="width:8px;font-size:1px">&nbsp;</td>${cell(row[1])}</tr>`).join("")}</table>`;
    }
    case "rows":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">${block.items.map((item, index) => `<tr><td style="padding:9px 12px 9px 0;border-top:1px solid ${index ? C.line : "transparent"};font-family:${FONT};font-size:13px;color:${C.muted};white-space:nowrap" valign="top">${escapeHtml(item.label)}</td><td style="padding:9px 0;border-top:1px solid ${index ? C.line : "transparent"};font-family:${FONT};font-size:14px;color:${C.text};text-align:right" valign="top">${inline(item.value)}</td></tr>`).join("")}</table>`;
  }
}

/** De volledige HTML van een mail in huisstijl. */
export function renderBrandedEmail(mail: BrandedMail) {
  const lang = mail.language ?? "nl";
  const preheader = mail.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${escapeHtml(mail.preheader)}${"&#847;&zwnj;&nbsp;".repeat(30)}</div>` : "";
  const footer = [
    ...(mail.footer ?? []),
    lang === "nl" ? "SequenceFlow · KvK 78237750 · Nederland" : "SequenceFlow · Chamber of Commerce 78237750 · The Netherlands",
  ];
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${escapeHtml(mail.title ?? "SequenceFlow")}</title>
<style>:root{color-scheme:dark}@media (max-width:600px){.sf-card{padding:28px 20px!important}.sf-title{font-size:24px!important}}</style></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 12px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td style="padding:0 8px 20px"><a href="${SITE}" style="text-decoration:none"><img src="${LOGO}" width="150" height="36" alt="SequenceFlow" style="display:block;border:0;width:150px;height:auto;color:${C.text};font-family:${FONT};font-size:18px;font-weight:700"></a></td></tr>
<tr><td class="sf-card" style="padding:36px 36px 28px;border:1px solid ${C.line};border-radius:20px;background:${C.card}">
${mail.eyebrow ? `<div style="margin:0 0 10px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.lime}">${escapeHtml(mail.eyebrow)}</div>` : ""}
${mail.title ? `<h1 class="sf-title" style="margin:0 0 20px;font-family:${FONT};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-.02em;color:${C.text}">${escapeHtml(mail.title)}</h1>` : ""}
${mail.blocks.map(renderBlock).join("\n")}
${mail.signature ? p(inline(mail.signature), `margin:24px 0 0;color:${C.muted}`) : ""}
</td></tr>
<tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#71717a">${footer.map((line) => inline(line, "#a1a1aa")).join("<br>")}</td></tr>
</table></td></tr></table>
</body></html>`;
}

/* ---------- Van tekst naar blokken ---------- */

const GREETING = /^(hoi|hi|hallo|hello|beste|dear)\b[^\n]{0,40},?$/i;
const SIGN_OFF = /^(groet|groeten|cheers|best|team sequenceflow|the sequenceflow team|met vriendelijke groet)/i;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET = /^\s*[-•]\s+(.*)$/;
const LONE_URL = /^(?:(.{2,80}?):?\s+)?(https?:\/\/\S+)$/;

/**
 * Zet een tekstmail om naar blokken: alinea's, genummerde en gewone lijsten,
 * en een regel die eindigt op een link wordt een knop. De aanhef wordt
 * weggelaten (de titel neemt die plaats in) en de afsluiting wordt de
 * ondertekening. Zo blijft de tekstversie de bron en lopen HTML en tekst
 * nooit uiteen.
 */
export function textToBlocks(text: string): { blocks: MailBlock[]; signature?: string; greeting?: string } {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((part) => part.replace(/\s+$/, "")).filter((part) => part.trim());
  let greeting: string | undefined;
  let signature: string | undefined;
  if (paragraphs.length && GREETING.test(paragraphs[0].trim())) greeting = paragraphs.shift()!.trim();
  const lastIndex = paragraphs.length - 1;
  if (lastIndex >= 0 && (SIGN_OFF.test(paragraphs[lastIndex].trim()) || /^[A-Z][a-z]+(\n.*)?$/.test(paragraphs[lastIndex].trim()) && paragraphs[lastIndex].split("\n").length <= 2 && paragraphs[lastIndex].length < 60)) {
    signature = paragraphs.pop()!.trim();
  }

  const blocks: MailBlock[] = [];
  for (const paragraph of paragraphs) {
    const lines = paragraph.split("\n");
    let buffer: string[] = [];
    let list: { ordered: boolean; items: Array<{ title: string; text?: string }> } | null = null;
    const flushText = () => {
      if (buffer.length) blocks.push({ type: "paragraph", text: buffer.join("\n") });
      buffer = [];
    };
    const flushList = () => {
      if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
      list = null;
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const ordered = line.match(ORDERED);
      const bullet = line.match(BULLET);
      const url = line.trim().match(LONE_URL);
      if (ordered || bullet) {
        flushText();
        const isOrdered = Boolean(ordered);
        if (!list || list.ordered !== isOrdered) { flushList(); list = { ordered: isOrdered, items: [] }; }
        list.items.push({ title: (ordered ? ordered[2] : bullet![1]).trim() });
      } else if (list && /^\s{2,}\S/.test(raw)) {
        const item = list.items[list.items.length - 1];
        item.text = item.text ? `${item.text}\n${line.trim()}` : line.trim();
      } else if (url && !url[1]?.includes(".")) {
        flushList();
        flushText();
        const label = (url[1] ?? "").replace(/[:\s]+$/, "").trim();
        blocks.push(label ? { type: "button", label, href: url[2] } : { type: "button", label: url[2].replace(/^https?:\/\/(www\.)?/, ""), href: url[2] });
      } else {
        flushList();
        if (line.trim()) buffer.push(line.trim());
      }
    }
    flushList();
    flushText();
  }
  return { blocks, signature, greeting };
}

/** HTML-versie van een bestaande tekstmail, in huisstijl. */
export function brandedFromText(input: { text: string; eyebrow?: string; title?: string; preheader?: string; footer?: string[]; language?: "nl" | "en"; action?: { label: string; href: string } }) {
  const { blocks, signature, greeting } = textToBlocks(input.text);
  if (input.action) blocks.push({ type: "button", ...input.action });
  // Zonder eigen titel wordt de aanhef ("Hoi Juju,") de titel.
  const title = input.title ?? greeting?.replace(/,$/, "");
  const firstText = blocks.find((block): block is Extract<MailBlock, { type: "paragraph" }> => block.type === "paragraph")?.text;
  return renderBrandedEmail({ eyebrow: input.eyebrow, footer: input.footer, language: input.language, title, blocks, signature, preheader: input.preheader ?? firstText?.slice(0, 140) });
}
