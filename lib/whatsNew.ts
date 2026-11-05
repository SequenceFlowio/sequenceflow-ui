/**
 * "Wat is nieuw": het logboek met nieuwe functies en updates voor gebruikers.
 * Een nieuwe entry zet je bovenaan, met een unieke id; de badge in de zijbalk
 * telt de ids die iemand nog niet gezien heeft.
 */

export type WhatsNewCategory = "new" | "improved" | "fixed";

type Text = { nl: string; en: string };

export type WhatsNewEntry = {
  /** Uniek en nooit meer veranderen: hierop onthouden we wat gezien is. */
  id: string;
  /** YYYY-MM-DD, de dag dat het live ging. */
  date: string;
  category: WhatsNewCategory;
  title: Text;
  body: Text;
  link?: { href: string; label: Text };
  /** Alleen tonen als Voorraad aanstaat (NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED). */
  inventory?: boolean;
};

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: "2026-11-security-review",
    date: "2026-11-04",
    category: "improved",
    title: { nl: "Veiliger en betrouwbaarder", en: "Safer and more reliable" },
    body: {
      nl: "We hebben Support One grondig nagekeken. Openbare pagina's zijn beschermd tegen misbruik, een betaling wordt nooit twee keer verwerkt en je mailbox haalt elk bericht maar één keer op.",
      en: "We gave Support One a thorough check. Public pages are protected against abuse, a payment is never processed twice and your mailbox fetches each message only once.",
    },
  },
  {
    id: "2026-11-one-workspace",
    date: "2026-11-04",
    category: "fixed",
    title: { nl: "Duidelijke melding bij uitnodigen", en: "Clear message when inviting" },
    body: {
      nl: "Zit een collega al in een andere werkruimte? Dan zie je dat nu meteen bij het uitnodigen, in plaats van een vage fout.",
      en: "Is a colleague already in another workspace? You now see that right away when inviting, instead of a vague error.",
    },
    link: { href: "/settings?tab=team", label: { nl: "Naar Team", en: "Go to Team" } },
  },
  {
    id: "2026-11-vera",
    date: "2026-11-03",
    category: "new",
    title: { nl: "Maak kennis met Vera, je voorraadassistent", en: "Meet Vera, your stock assistant" },
    body: {
      nl: "Vera houdt je voorraad in de gaten en meldt het als er iets speelt: iets is uitverkocht terwijl klanten erom vragen, een levering is te laat of een seizoen komt eraan. Je kiest zelf de regels. Wat nieuw is, krijg je hoogstens één keer per dag per mail.",
      en: "Vera keeps an eye on your stock and tells you when something needs attention: an item sold out while customers ask for it, a late delivery or a season coming up. You choose the rules. Anything new reaches you by email at most once a day.",
    },
    link: { href: "/inventory", label: { nl: "Naar Voorraad", en: "Go to Stock" } },
    inventory: true,
  },
  {
    id: "2026-11-vera-chat",
    date: "2026-11-03",
    category: "new",
    title: { nl: "Vraag het aan Vera", en: "Ask Vera" },
    body: {
      nl: "Stel je vragen over je voorraad gewoon in de chat, zoals \"wat moet ik deze week bijbestellen?\". Vera noemt alleen cijfers uit je eigen winkel. Wil ze iets aanpassen, dan doet ze een voorstel dat jij eerst bevestigt.",
      en: "Just ask about your stock in the chat, like \"what should I reorder this week?\". Vera only quotes numbers from your own store. If she wants to change something, she makes a suggestion you confirm first.",
    },
    link: { href: "/inventory", label: { nl: "Chat met Vera", en: "Chat with Vera" } },
    inventory: true,
  },
  {
    id: "2026-11-purchase-order",
    date: "2026-11-03",
    category: "new",
    title: { nl: "Inkooporder in één klik", en: "Purchase order in one click" },
    body: {
      nl: "Vera zet per leverancier een concept-inkooporder klaar, met aantallen, inkoopprijs en totaal. Geef een budget op en ze kiest wat het eerst op is en het best verkoopt. Download als CSV of kopieer het mailconcept. Ook \"verdeel 200 hoodies over de maten\" kan.",
      en: "Vera drafts a purchase order per supplier, with quantities, cost price and total. Set a budget and she picks what runs out first and sells best. Download it as CSV or copy the email draft. \"Split 200 hoodies across sizes\" works too.",
    },
    link: { href: "/inventory", label: { nl: "Naar Voorraad", en: "Go to Stock" } },
    inventory: true,
  },
  {
    id: "2026-11-waitlist",
    date: "2026-11-03",
    category: "new",
    title: { nl: "Wachtlijst: weer op voorraad", en: "Waitlist: back in stock" },
    body: {
      nl: "Komt iets binnen waar klanten naar vroegen, dan zie je wie het zijn en staat er een mail voor ze klaar. Pas als jij op Verstuur klikt, gaat die mail vanuit je eigen mailbox de deur uit.",
      en: "When something comes back in that customers asked about, you see who they are and an email is ready for them. It only goes out, from your own mailbox, once you click Send.",
    },
    link: { href: "/inventory", label: { nl: "Naar Voorraad", en: "Go to Stock" } },
    inventory: true,
  },
  {
    id: "2026-11-suppliers-margin",
    date: "2026-11-03",
    category: "improved",
    title: { nl: "Leveranciers, marge en retouren", en: "Suppliers, margin and returns" },
    body: {
      nl: "Leg je leveranciers vast met hun levertijd en minimale bestelling; het advies rekent daar meteen mee. Per variant zie je nu ook de marge en hoe vaak hij terugkomt.",
      en: "Add your suppliers with their lead time and minimum order; the advice takes them into account right away. Each variant now also shows its margin and how often it gets returned.",
    },
    link: { href: "/inventory", label: { nl: "Naar Voorraad", en: "Go to Stock" } },
    inventory: true,
  },
  {
    id: "2026-11-seasons",
    date: "2026-11-03",
    category: "improved",
    title: { nl: "Seizoensproducten", en: "Seasonal products" },
    body: {
      nl: "Support One herkent nu producten die vooral in een paar maanden verkopen, zoals jassen of zwemkleding. Buiten hun seizoen heten ze niet meer dode voorraad en krijg je geen advies om bij te bestellen. Je kunt de maanden per product ook zelf instellen.",
      en: "Support One now recognises products that mostly sell in a few months, like coats or swimwear. Outside their season they no longer count as dead stock and you get no advice to reorder. You can also set the months per product yourself.",
    },
    link: { href: "/inventory", label: { nl: "Naar Voorraad", en: "Go to Stock" } },
    inventory: true,
  },
  {
    id: "2026-11-shopify-disconnect",
    date: "2026-11-02",
    category: "new",
    title: { nl: "Shopify ontkoppelen", en: "Disconnect Shopify" },
    body: {
      nl: "Je kunt je Shopify-winkel nu zelf ontkoppelen onder Koppelingen. Daarna kun je opnieuw koppelen met een nieuwe code, ook als de app eerder uit Shopify verwijderd was.",
      en: "You can now disconnect your Shopify store yourself under Connections. Afterwards you can connect again with a new code, even if the app was removed from Shopify earlier.",
    },
    link: { href: "/integrations?koppeling=shopify", label: { nl: "Naar Shopify", en: "Go to Shopify" } },
  },
  {
    id: "2026-11-inventory-demo",
    date: "2026-11-02",
    category: "new",
    title: { nl: "Voorraad uitproberen met een demo-winkel", en: "Try Stock with a demo store" },
    body: {
      nl: "Nog geen winkel gekoppeld? We kunnen je werkruimte vullen met een demo-winkel met twee jaar verzonnen verkoop, zodat je het inkoopadvies en Vera rustig kunt uitproberen. Vraag het via Support.",
      en: "No store connected yet? We can fill your workspace with a demo store with two years of made-up sales, so you can try the buying advice and Vera at your own pace. Ask us via Support.",
    },
    inventory: true,
  },
  {
    id: "2026-11-referrals",
    date: "2026-11-01",
    category: "new",
    title: { nl: "Doorverwijzen en affiliateprogramma", en: "Referrals and affiliate program" },
    body: {
      nl: "Raad Support One aan met je eigen link. Voor elke nieuwe betalende klant krijg je tegoed, en zij krijgen 10% korting op hun eerste maand. Wil je er meer van maken, dan verdien je als affiliate een deel van wat jouw klanten blijven betalen.",
      en: "Recommend Support One with your own link. You get credit for every new paying customer, and they get 10% off their first month. Want to go further? As an affiliate you earn a share of what your customers keep paying.",
    },
    link: { href: "/settings?tab=referral", label: { nl: "Naar Doorverwijzen", en: "Go to Refer & earn" } },
  },
  {
    id: "2026-10-buying-advice",
    date: "2026-10-30",
    category: "new",
    title: { nl: "Inkoopadvies per variant", en: "Buying advice per variant" },
    body: {
      nl: "Op de nieuwe pagina Voorraad zie je per maat en kleur hoe snel hij verkoopt, hoelang je voorraad nog meegaat en hoeveel je moet bijbestellen. Ook zie je waar klanten per variant naar vragen, zoals maat of levertijd.",
      en: "On the new Stock page you see per size and colour how fast it sells, how long your stock will last and how much to reorder. You also see what customers ask about per variant, like size or delivery time.",
    },
    link: { href: "/inventory", label: { nl: "Naar Voorraad", en: "Go to Stock" } },
    inventory: true,
  },
  {
    id: "2026-10-mcp",
    date: "2026-10-28",
    category: "new",
    title: { nl: "Support One in Claude en ChatGPT", en: "Support One in Claude and ChatGPT" },
    body: {
      nl: "Koppel Support One aan Claude of ChatGPT en vraag daar naar je klantvragen, gesprekken en kennisbank. Het koppelen kan alleen lezen en ziet alleen je eigen winkel. Je kunt het altijd weer intrekken.",
      en: "Connect Support One to Claude or ChatGPT and ask about your customer questions, conversations and knowledge base there. The connection can only read and only sees your own store. You can revoke it at any time.",
    },
    link: { href: "/integrations?koppeling=ai", label: { nl: "Koppel Claude of ChatGPT", en: "Connect Claude or ChatGPT" } },
  },
  {
    id: "2026-10-integrations-overview",
    date: "2026-10-28",
    category: "improved",
    title: { nl: "Nieuw overzicht van je koppelingen", en: "New overview of your connections" },
    body: {
      nl: "Alle koppelingen staan nu als tegels op één pagina, met per koppeling of hij werkt. WooCommerce is ook weer terug.",
      en: "All connections are now tiles on one page, each showing whether it works. WooCommerce is back too.",
    },
    link: { href: "/integrations", label: { nl: "Naar Koppelingen", en: "Go to Connections" } },
  },
  {
    id: "2026-10-shopify-stock",
    date: "2026-10-26",
    category: "new",
    title: { nl: "Shopify: producten en voorraad", en: "Shopify: products and stock" },
    body: {
      nl: "Geef Support One in Shopify toegang tot je producten en voorraad. Dan kan het bij een vraag als \"is dit nog leverbaar?\" meteen het juiste antwoord geven.",
      en: "Give Support One access to your products and stock in Shopify. It can then answer a question like \"is this still available?\" correctly right away.",
    },
    link: { href: "/integrations?koppeling=shopify", label: { nl: "Naar Shopify", en: "Go to Shopify" } },
  },
];

/** Wat deze gebruiker te zien krijgt, nieuwste eerst. */
export function visibleEntries(entries: WhatsNewEntry[], options: { inventory: boolean }): WhatsNewEntry[] {
  return entries
    .filter((entry) => options.inventory || !entry.inventory)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Hoeveel zichtbare entries nog niet gezien zijn. */
export function unseenCount(entries: WhatsNewEntry[], seenIds: ReadonlySet<string>): number {
  return entries.filter((entry) => !seenIds.has(entry.id)).length;
}

export function categoryLabel(category: WhatsNewCategory, nl: boolean): string {
  const labels: Record<WhatsNewCategory, [string, string]> = {
    new: ["Nieuw", "New"],
    improved: ["Verbeterd", "Improved"],
    fixed: ["Opgelost", "Fixed"],
  };
  return labels[category][nl ? 0 : 1];
}

export const inventoryEnabled = () => process.env.NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED === "true";
