/**
 * SequenceFlow Academy (/nl/academy, /en/academy): korte uitlegvideo's voor
 * webshopondernemers, per categorie (de contentpijlers van Instagram en TikTok).
 *
 * Elke les heeft per taal een status: "planned" (nog maken) of "ready" (video
 * staat klaar). Zo zie je in de backoffice (tab Academy) meteen welke video's
 * er nog gemaakt moeten worden. Een video toevoegen = `video` invullen en de
 * status op "ready" zetten.
 *
 * Geen imports met een alias: de tests laden dit bestand direct.
 */

export type LessonStatus = "planned" | "ready";

export type Lesson = {
  id: string;
  minutes: number;
  nl: { title: string; description: string };
  en: { title: string; description: string };
  status: { nl: LessonStatus; en: LessonStatus };
  /** Bestandsnaam of link van de video, per taal, zodra hij er is. */
  video?: { nl?: string; en?: string };
  /** Stilstaand beeld voor de speler, per taal. */
  poster?: { nl?: string; en?: string };
};

export type AcademyCategory = {
  id: string;
  /** Bij welke content op Instagram en TikTok deze categorie hoort. */
  pillar: string;
  nl: { title: string; description: string };
  en: { title: string; description: string };
  lessons: Lesson[];
};

const planned = { nl: "planned", en: "planned" } as const;

export const ACADEMY: ReadonlyArray<AcademyCategory> = [
  {
    id: "klantenservice",
    pillar: "Aware-reels, klantcontact",
    nl: { title: "Klantenservice die zichzelf terugbetaalt", description: "Minder vragen, snellere antwoorden en klanten die terugkomen." },
    en: { title: "Customer service that pays for itself", description: "Fewer questions, faster replies and customers who come back." },
    lessons: [
      { id: "vijf-vragen", minutes: 4, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les1-de-5-vragen-NL.mp4" }, poster: { nl: "/academy/les1-de-5-vragen-NL.jpg" },
        nl: { title: "De 5 vragen die je inbox vullen", description: "Welke vragen elke week terugkomen en hoe je ze voorkomt." },
        en: { title: "The 5 questions that fill your inbox", description: "Which questions come back every week and how to prevent them." } },
      { id: "boze-klant", minutes: 3, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les2-van-boze-klant-naar-fan-NL.mp4" }, poster: { nl: "/academy/les2-van-boze-klant-naar-fan-NL.jpg" },
        nl: { title: "Van boze klant naar fan", description: "Wat je zegt, wat je doet en wat het je oplevert." },
        en: { title: "From angry customer to fan", description: "What to say, what to do and what it earns you." } },
      { id: "in-een-keer", minutes: 3, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les3-in-een-keer-oplossen-NL.mp4" }, poster: { nl: "/academy/les3-in-een-keer-oplossen-NL.jpg" },
        nl: { title: "Antwoorden die het in één keer oplossen", description: "Zo voorkom je de tweede en derde mail over hetzelfde." },
        en: { title: "Replies that solve it in one go", description: "How to avoid the second and third email about the same thing." } },
      { id: "hoe-snel", minutes: 3, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les4-hoe-snel-antwoorden-NL.mp4" }, poster: { nl: "/academy/les4-hoe-snel-antwoorden-NL.jpg" },
        nl: { title: "Hoe snel moet je eigenlijk antwoorden?", description: "Wanneer elk uur telt, en waarom voorspelbaar beter is dan snel." },
        en: { title: "How fast should you actually reply?", description: "When every hour counts, and why predictable beats fast." } },
      { id: "faq", minutes: 3, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les5-faq-die-mensen-lezen-NL.mp4" }, poster: { nl: "/academy/les5-faq-die-mensen-lezen-NL.jpg" },
        nl: { title: "Een FAQ-pagina die mensen echt lezen", description: "Vijf stappen naar een FAQ die je inbox leger maakt." },
        en: { title: "An FAQ page people actually read", description: "Five steps to an FAQ that empties your inbox." } },
    ],
  },
  {
    id: "marges",
    pillar: "Unaware-reels, rekensommen",
    nl: { title: "Margelekken: waar je geld verliest", description: "Verzending, retouren en checkout, met de rekensom erbij." },
    en: { title: "Margin leaks: where you lose money", description: "Shipping, returns and checkout, with the numbers to match." },
    lessons: [
      { id: "verzending", minutes: 3, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les6-verzenden-zonder-margeverlies-NL.mp4" }, poster: { nl: "/academy/les6-verzenden-zonder-margeverlies-NL.jpg" },
        nl: { title: "Verzenden zonder marge te verliezen", description: "Dozen, gratis verzending en de niet-thuiscode." },
        en: { title: "Shipping without losing margin", description: "Boxes, free shipping and failed deliveries." } },
      { id: "retouren", minutes: 3, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les7-wat-een-retour-kost-NL.mp4" }, poster: { nl: "/academy/les7-wat-een-retour-kost-NL.jpg" },
        nl: { title: "Wat een retour je echt kost", description: "Reken het uit, en zo haal je het omlaag." },
        en: { title: "What a return really costs you", description: "Work it out, then bring it down." } },
      { id: "checkout-kosten", minutes: 3, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les8-kleine-lekken-NL.mp4" }, poster: { nl: "/academy/les8-kleine-lekken-NL.jpg" },
        nl: { title: "Betaalmethodes en kleine lekken", description: "Transactiekosten, tools die niemand opent en meer." },
        en: { title: "Payment methods and small leaks", description: "Transaction fees, tools nobody opens and more." } },
      { id: "korting", minutes: 2, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les9-korting-NL.mp4" }, poster: { nl: "/academy/les9-korting-NL.jpg" },
        nl: { title: "Korting die je meer kost dan hij oplevert", description: "Wanneer een actie je marge opeet, en wat beter werkt." },
        en: { title: "Discounts that cost more than they earn", description: "When a promotion eats your margin, and what works better." } },
      { id: "voorraad", minutes: 3, status: { nl: "ready", en: "planned" },
        video: { nl: "/academy/les10-voorraad-NL.mp4" }, poster: { nl: "/academy/les10-voorraad-NL.jpg" },
        nl: { title: "Voorraad: geld dat op de plank ligt", description: "Dode voorraad en uitverkochte bestsellers." },
        en: { title: "Stock: money sitting on the shelf", description: "Dead stock and sold-out bestsellers." } },
    ],
  },
  {
    id: "regels",
    pillar: "Tips over wet en regels",
    nl: { title: "Webshopregels in 5 minuten", description: "Wat er nu verplicht is, zonder juridisch jargon." },
    en: { title: "Online store rules in 5 minutes", description: "What's required now, without the legal jargon." },
    lessons: [
      { id: "herroepen", minutes: 5, status: planned,
        nl: { title: "Bedenktijd en de herroepknop", description: "Wat je klant mag en wat jij moet regelen." },
        en: { title: "Cooling-off period and the withdrawal button", description: "What your customer may do and what you need to arrange." } },
      { id: "claims", minutes: 4, status: planned,
        nl: { title: "\"Duurzaam\" en andere claims", description: "Wat je nog mag zeggen in je productteksten." },
        en: { title: "\"Sustainable\" and other claims", description: "What you can still say in your product copy." } },
      { id: "toegankelijkheid", minutes: 5, status: planned,
        nl: { title: "Toegankelijkheid van je webshop", description: "Wat er verplicht is en waar je begint." },
        en: { title: "Accessibility of your store", description: "What's required and where to start." } },
      { id: "reviews-regels", minutes: 3, status: planned,
        nl: { title: "Reviews: wat mag wel en wat niet", description: "Nepreviews, echtheid aantonen en wat je moet vermelden." },
        en: { title: "Reviews: what is and isn't allowed", description: "Fake reviews, proving authenticity and what to disclose." } },
      { id: "kortingen-tonen", minutes: 3, status: planned,
        nl: { title: "Kortingen eerlijk tonen", description: "De regel van de laagste prijs in de afgelopen 30 dagen." },
        en: { title: "Showing discounts honestly", description: "The lowest-price-in-30-days rule." } },
    ],
  },
  {
    id: "groei",
    pillar: "Carrousels over marketing",
    nl: { title: "Groeien zonder meer advertentiebudget", description: "E-maillijst, verlaten winkelwagens en terugkerende klanten." },
    en: { title: "Grow without a bigger ad budget", description: "Email list, abandoned carts and returning customers." },
    lessons: [
      { id: "emaillijst", minutes: 5, status: planned,
        nl: { title: "Je e-maillijst laten groeien", description: "Van eerste bezoek tot vaste klant." },
        en: { title: "Growing your email list", description: "From first visit to regular customer." } },
      { id: "winkelwagens", minutes: 5, status: planned,
        nl: { title: "Verlaten winkelwagens terughalen", description: "Welke mails werken en wanneer je ze stuurt." },
        en: { title: "Winning back abandoned carts", description: "Which emails work and when to send them." } },
      { id: "influencer", minutes: 5, status: planned,
        nl: { title: "Influencer of advertentie?", description: "Zo vergelijk je wat het je echt oplevert." },
        en: { title: "Influencer or ad?", description: "How to compare what each really earns you." } },
      { id: "tweede-bestelling", minutes: 4, status: planned,
        nl: { title: "Van eerste naar tweede bestelling", description: "Wat je na de eerste aankoop doet, zodat ze terugkomen." },
        en: { title: "From first to second order", description: "What to do after the first purchase so they come back." } },
      { id: "reviews-verzamelen", minutes: 3, status: planned,
        nl: { title: "Reviews verzamelen die verkopen", description: "Wanneer je vraagt, hoe je vraagt en waar je ze laat zien." },
        en: { title: "Collecting reviews that sell", description: "When to ask, how to ask and where to show them." } },
    ],
  },
  {
    id: "ondernemen",
    pillar: "Tips over productiviteit en delegeren",
    nl: { title: "Werk minder in je eigen bedrijf", description: "Focus, delegeren en processen die zonder jou draaien." },
    en: { title: "Work less in your own business", description: "Focus, delegation and processes that run without you." },
    lessons: [
      { id: "zelf-doen", minutes: 5, status: planned,
        nl: { title: "Wat moet jij écht zelf doen?", description: "Een simpele scan van je week." },
        en: { title: "What do you really need to do yourself?", description: "A simple scan of your week." } },
      { id: "delegeren", minutes: 5, status: planned,
        nl: { title: "Delegeren met een video", description: "Werkinstructies die iemand anders echt kan volgen." },
        en: { title: "Delegating with a video", description: "Work instructions someone else can actually follow." } },
      { id: "jaarplan", minutes: 4, status: planned,
        nl: { title: "Je jaarplan op één A4", description: "Wat je dit jaar wél en niet doet." },
        en: { title: "Your yearly plan on one page", description: "What you will and won't do this year." } },
      { id: "eerste-hulp", minutes: 4, status: planned,
        nl: { title: "Je eerste hulp: VA, freelancer of personeel?", description: "Wat bij welke taak past, en wat het kost." },
        en: { title: "Your first help: VA, freelancer or employee?", description: "What fits which task, and what it costs." } },
      { id: "cijfers", minutes: 3, status: planned,
        nl: { title: "De 5 cijfers die je elke week bekijkt", description: "Een kwartier per week dat je bedrijf in beeld houdt." },
        en: { title: "The 5 numbers to check every week", description: "Fifteen minutes a week that keep your business in view." } },
    ],
  },
  {
    id: "conversie",
    pillar: "Carrousels over de webshop",
    nl: { title: "Een webshop die verkoopt", description: "Productpagina, checkout en de mythes die je kunt overslaan." },
    en: { title: "A store that sells", description: "Product page, checkout and the myths you can skip." },
    lessons: [
      { id: "productpagina", minutes: 5, status: planned,
        nl: { title: "Een productpagina die vragen voorkomt", description: "Wat erop moet staan, zodat niemand hoeft te mailen." },
        en: { title: "A product page that prevents questions", description: "What it needs so nobody has to email you." } },
      { id: "checkout", minutes: 5, status: planned,
        nl: { title: "Een checkout die niet afschrikt", description: "Verplichte accounts, minimumbedragen en andere drempels." },
        en: { title: "A checkout that doesn't scare people off", description: "Forced accounts, minimum orders and other hurdles." } },
      { id: "mythes", minutes: 4, status: planned,
        nl: { title: "Mythes over conversie", description: "Prijzen op ,99, livechat en pop-ups met korting." },
        en: { title: "Conversion myths", description: "Prices ending in .99, live chat and discount pop-ups." } },
      { id: "productfotos", minutes: 3, status: planned,
        nl: { title: "Productfoto's die verkopen", description: "Wat je laat zien, zodat niemand hoeft te vragen." },
        en: { title: "Product photos that sell", description: "What to show so nobody has to ask." } },
      { id: "mobiel", minutes: 3, status: planned,
        nl: { title: "Je webshop op mobiel", description: "De meeste klanten kijken op hun telefoon. Zo test je dat." },
        en: { title: "Your store on mobile", description: "Most customers browse on their phone. Here's how to test it." } },
    ],
  },
];

export function academyStats(categories: ReadonlyArray<AcademyCategory> = ACADEMY) {
  const lessons = categories.flatMap((category) => category.lessons);
  const count = (lang: "nl" | "en") => lessons.filter((lesson) => lesson.status[lang] === "ready").length;
  return {
    categories: categories.length,
    lessons: lessons.length,
    minutes: lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
    ready: { nl: count("nl"), en: count("en") },
  };
}

/** Waar de lessen staan (na aanmelden), per taal. */
export const ACADEMY_LIBRARY = { nl: "/nl/academy/lessen", en: "/en/academy/lessons" } as const;

/**
 * De video's staan niet in git (de posters wel). Lokaal komen ze uit public/academy;
 * online zet je NEXT_PUBLIC_ACADEMY_MEDIA_URL op de map met de bestanden
 * (bijvoorbeeld https://media.sequenceflow.io/academy).
 */
export function academyMedia(file: string | undefined, base = process.env.NEXT_PUBLIC_ACADEMY_MEDIA_URL) {
  if (!file) return undefined;
  if (!base || /^https?:/.test(file)) return file;
  return `${base.replace(/\/$/, "")}/${file.replace(/^\/academy\//, "")}`;
}
