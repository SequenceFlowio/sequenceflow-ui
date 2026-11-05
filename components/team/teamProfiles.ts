import type { MarkGear } from "@/components/marketing/SequenceMark";
import type { TeamAgent } from "@/lib/assistants/team";

type Text = { nl: string; en: string };

export type TeamProfile = {
  name: string;
  gear: MarkGear;
  /** Themakleur; Milo houdt het merkgroen en krijgt geen eigen tint. */
  color: string;
  tint?: string;
  role: Text;
  character: Text;
  catchphrase: Text;
  can: Text[];
  never: Text[];
  /** Wat je ziet terwijl hij werkt. */
  working: Text;
  early?: boolean;
};

export const TEAM_PROFILES: Record<TeamAgent, TeamProfile> = {
  milo: {
    name: "Milo",
    gear: "antenna",
    color: "#C7F56F",
    role: { nl: "Je manager", en: "Your manager" },
    character: { nl: "De kalme verbinder. Overziet alles, zegt het in één zin en eindigt met één volgende stap. Zijn antenne licht op in de kleur van wie hij erbij roept.", en: "The calm connector. Sees the whole picture, says it in one sentence and ends with one next step. His antenna lights up in the colour of whoever he calls in." },
    catchphrase: { nl: "Komt goed. Ik zet het uit.", en: "On it. I'll hand it out." },
    can: [{ nl: "Je vraag naar de juiste specialist sturen", en: "Send your question to the right specialist" }, { nl: "Inzichten uit je klantcontact en bestellingen", en: "Insights from your support and orders" }],
    never: [{ nl: "Iets veranderen in je account", en: "Change anything in your account" }],
    working: { nl: "Milo kijkt in je gegevens…", en: "Milo is looking at your data…" },
  },
  seffy: {
    name: "Seffy",
    gear: "headset",
    color: "#FFA98A",
    tint: "#FFA98A",
    role: { nl: "Klantmails", en: "Customer email" },
    character: { nl: "Warm en vlot. Leest elke klantvraag alsof het de eerste van de dag is en denkt mee in jouw toon.", en: "Warm and quick. Reads every customer question as if it's the first of the day and thinks along in your tone." },
    catchphrase: { nl: "Hey baas! Laat mij maar.", en: "Hey boss! Leave it to me." },
    can: [{ nl: "Een gedeelde klantvraag doorlichten", en: "Look into a shared customer question" }, { nl: "Patronen in je klantmails uitleggen", en: "Explain patterns in your customer email" }],
    never: [{ nl: "Een mail versturen vanuit deze chat", en: "Send an email from this chat" }],
    working: { nl: "Seffy leest mee…", en: "Seffy is reading…" },
  },
  otis: {
    name: "Otis",
    gear: "analyst",
    color: "#91B8D0",
    tint: "#91B8D0",
    role: { nl: "Voorraad & inkoop", en: "Stock & buying" },
    character: { nl: "Precies en een tikje droog. Telt alles twee keer na en rekent in dagen, niet in stuks.", en: "Precise and a little dry. Counts everything twice and thinks in days, not units." },
    catchphrase: { nl: "Ik heb het nageteld.", en: "I double-checked." },
    can: [{ nl: "Zien wanneer een variant op raakt", en: "See when a variant runs out" }, { nl: "Een concept-inkooporder klaarzetten", en: "Prepare a draft purchase order" }],
    never: [{ nl: "Iets wijzigen zonder jouw bevestiging", en: "Change anything without your confirmation" }],
    working: { nl: "Otis telt je voorraad na…", en: "Otis is counting your stock…" },
  },
  juno: {
    name: "Juno",
    gear: "camera",
    color: "#C4B5FD",
    tint: "#C4B5FD",
    role: { nl: "Content", en: "Content" },
    character: { nl: "Nieuwsgierig en beeldend. Ziet in elke klantvraag een idee voor een post.", en: "Curious and visual. Sees a post idea in every customer question." },
    catchphrase: { nl: "Oeh, daar zit een post in!", en: "Ooh, there's a post in that!" },
    can: [{ nl: "Early access: binnenkort ideeën en captions", en: "Early access: ideas and captions soon" }],
    never: [{ nl: "Iets publiceren", en: "Publish anything" }],
    working: { nl: "Juno denkt mee…", en: "Juno is thinking…" },
    early: true,
  },
};
