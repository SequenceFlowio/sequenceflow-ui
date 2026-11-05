/**
 * Milo en zijn team: wie er is, wie welke vraag krijgt, Milo's dagzin en het
 * voorgestelde antwoord onder een vraag van een agent. Puur, zonder database,
 * zodat de chat en de tests dezelfde regels gebruiken.
 */

export type TeamAgent = "milo" | "seffy" | "otis" | "juno";

export const TEAM_MEMBERS: readonly TeamAgent[] = ["seffy", "otis", "juno"];

const NAMES: Record<TeamAgent, RegExp> = {
  milo: /\bmilo\b/,
  seffy: /\bseff?y\b|\bsefi\b/,
  otis: /\botis\b/,
  juno: /\bjuno\b/,
};

const STOCK = /voorraad|\bstock\b|inventory|inkoop|bijbestel|nabestel|leverancier|supplier|uitverkocht|sold out|wachtlijst|waitlist|\bsku\b|levering(en)?\b|delivery|op raakt|runs? out|reorder|purchase order|seizoen|season|marge|margin/;
const CONTENT = /\bposts?\b|caption|instagram|\binsta\b|tiktok|\breels?\b|\bcontent\b|social media|linkedin|nieuwsbrief|newsletter/;
const MAIL = /deze (mail|klant|klantvraag|vraag)|klantmail|klantvra(ag|gen)|klantcontact|\binbox\b|\bsupport\b|\btickets?\b|klanten (vragen|mailen|klagen|willen)|vragen over|this (e-?mail|mail|customer|ticket)|customer (questions?|e-?mails?|support|service)|antwoord (op|voor|aan)|reply (to|for)|concept(antwoord)?|\bdraft\b|mail van|e-?mail from|klant (vraagt|wil|schrijft|mailt)|customer (asks|wants|writes)/;

/**
 * Wie pakt deze vraag op? Een genoemde naam wint, daarna een gedeelde
 * klantvraag, dan het onderwerp. Zonder duidelijk onderwerp blijft een kort
 * vervolg ("ja, zet hem klaar") bij wie er al bij zit; een nieuwe vraag
 * beantwoordt Milo zelf.
 */
export function routeQuestion(text: string, input: { mailAttached?: boolean; current?: TeamAgent | null } = {}): TeamAgent {
  const value = text.toLowerCase();
  for (const agent of ["seffy", "otis", "juno", "milo"] as const) if (NAMES[agent].test(value)) return agent;
  if (STOCK.test(value)) return "otis";
  if (CONTENT.test(value)) return "juno";
  if (MAIL.test(value)) return "seffy";
  if (input.current && isFollowUp(value)) return input.current;
  // Een gedeelde klantvraag gaat naar Seffy, tenzij er net iemand anders aan
  // het woord was en dit duidelijk een nieuwe vraag is.
  if (input.mailAttached && (!input.current || isFollowUp(value))) return "seffy";
  return "milo";
}

const FOLLOW_UP = /^(ja|nee|ok|oké|oke|graag|prima|top|doe maar|zet|maak|laat|leg|waarom|hoe dan|en |dat|die|deze|dit|hij|ze|yes|no|sure|please|go|why|and |that|this|it)\b/;

/** Een kort antwoord of "ja, doe maar" hoort bij wie het laatst sprak; een nieuwe vraag gaat naar Milo. */
function isFollowUp(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length <= 4 || FOLLOW_UP.test(value.trim());
}

/** Milo's zin bij het openen: wat wacht er, wat brandt er, en waar je kunt beginnen. */
export function miloBriefing(input: { language: "nl" | "en"; hour: number; review: number | null; escalated: number | null; stockAlerts: number | null }) {
  const nl = input.language === "nl";
  const greeting = input.hour < 12 ? (nl ? "Goedemorgen" : "Good morning") : input.hour < 18 ? (nl ? "Goedemiddag" : "Good afternoon") : (nl ? "Goedenavond" : "Good evening");
  if (input.review === null && input.stockAlerts === null) {
    return nl
      ? `${greeting}! Ik ben Milo. Vraag me wat je wilt: ik weet wie in het team het beste kan helpen en haal die erbij.`
      : `${greeting}! I'm Milo. Ask me anything: I know who on the team can help best and bring them in.`;
  }
  const review = input.review ?? 0;
  const escalated = input.escalated ?? 0;
  const alerts = input.stockAlerts ?? 0;
  if (!review && !escalated && !alerts) {
    return nl ? `${greeting}! Rustig vandaag: er wacht niks op je en er brandt niks.` : `${greeting}! Quiet today: nothing is waiting for you and nothing is on fire.`;
  }
  const parts: string[] = [];
  if (review) parts.push(nl ? `${review} ${review === 1 ? "klantvraag wacht" : "klantvragen wachten"} op je akkoord` : `${review} customer ${review === 1 ? "question is" : "questions are"} waiting for your approval`);
  if (escalated) parts.push(nl ? `${escalated} ${escalated === 1 ? "vraag heeft" : "vragen hebben"} jou echt nodig` : `${escalated} ${escalated === 1 ? "question needs" : "questions need"} you personally`);
  if (alerts) parts.push(nl ? `Otis heeft ${alerts} ${alerts === 1 ? "voorraadmelding" : "voorraadmeldingen"}` : `Otis has ${alerts} stock ${alerts === 1 ? "alert" : "alerts"}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${nl ? "en" : "and"} ${parts.at(-1)}` : parts[0];
  return `${greeting}! ${list.charAt(0).toUpperCase()}${list.slice(1)}. ${nl ? "Waar wil je beginnen?" : "Where do you want to start?"}`;
}

/**
 * Een agent mag zijn antwoord afsluiten met een regel ">> …": het antwoord
 * dat jij waarschijnlijk geeft. Die regel tonen we niet in de bubbel maar als
 * voorstel in het invoerveld. Tijdens het streamen verdwijnt ook een half
 * binnengekomen ">"-regel, zodat er nooit een flits van de markering is.
 */
export function splitSuggestedReply(text: string): { content: string; suggestion: string | null } {
  const lines = text.split("\n");
  let suggestion: string | null = null;
  while (lines.length) {
    const last = lines[lines.length - 1].trim();
    if (!last) { lines.pop(); continue; }
    if (last.startsWith(">")) {
      const value = last.replace(/^>+\s*/, "").trim();
      if (last.startsWith(">>") && value) suggestion = value.slice(0, 80);
      lines.pop();
      continue;
    }
    break;
  }
  return { content: lines.join("\n").trimEnd(), suggestion };
}

/** De instructie die Milo, Seffy en Otis krijgen voor dat voorstel. */
export const SUGGESTED_REPLY_RULE = "If, and only if, you end with a question to the merchant, add one final line that starts with \">> \" followed by the short reply they are most likely to give (at most 8 words, in the merchant's language, for example \">> Ja, zet hem klaar\"). Never put anything after that line.";
