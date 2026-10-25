/**
 * Fotoplekken op de website. Zolang `src` leeg is, toont de pagina een
 * nette lege plek (en in development de briefing erbij). Een foto toevoegen:
 * zet het bestand in public/media/site/ en vul `src` hier in.
 *
 * De volledige briefing per plek staat in docs/website-fotocontent.md.
 */

export type MediaSlot = {
  /** Pad onder public, bijvoorbeeld "/media/site/hub-hero.jpg". */
  src?: string;
  alt: string;
  /** CSS aspect-ratio, bijvoorbeeld "16 / 9". */
  ratio: string;
  /** Korte briefing; alleen zichtbaar in development. */
  brief: string;
};

export const MEDIA_SLOTS = {
  "hub-hero": {
    alt: "E-commerce ondernemer aan het werk tussen verzenddozen en een laptop",
    ratio: "16 / 9",
    brief: "Ondernemer in een kleine webshopstudio: laptop open, verzenddozen, producten op een rek. Avond, warm licht, donkere tinten.",
  },
  "hub-support": {
    alt: "Webshopeigenaar die klantvragen afhandelt op een laptop",
    ratio: "4 / 3",
    brief: "Close-up: handen op laptop met inbox, kop koffie, verzendlabel ernaast. Donker, rustig.",
  },
  "hub-content": {
    alt: "Productfoto die met een telefoon wordt gemaakt voor social media",
    ratio: "4 / 3",
    brief: "Telefoon op statief filmt een product op een donkere ondergrond, ringlamp, schermpje toont een Reel.",
  },
  "hub-shop-fashion": {
    alt: "Kledingwebshop: kledingrek met nieuwe collectie",
    ratio: "3 / 4",
    brief: "Fashion-webshop: rek met kleding, verzendzakken. Staand formaat.",
  },
  "hub-shop-beauty": {
    alt: "Beautywebshop: verzorgingsproducten klaar voor verzending",
    ratio: "3 / 4",
    brief: "Skincare/beauty: flesjes en potjes op stenen ondergrond, één doos half open.",
  },
  "hub-shop-home": {
    alt: "Woonwebshop: interieurproducten in een sfeervolle setting",
    ratio: "3 / 4",
    brief: "Home & living: vaas, kaars, plaid op een donkere tafel. Staand formaat.",
  },
  "content-product": {
    alt: "Productfoto zoals die in een webshop staat",
    ratio: "1 / 1",
    brief: "Schone packshot van één product (bijv. sneaker of serum) op effen achtergrond: de 'invoer'.",
  },
  "content-post": {
    alt: "Social-mediapost die van de productfoto is gemaakt",
    ratio: "4 / 5",
    brief: "Hetzelfde product in een lifestylescène, klaar als Instagram-post: de 'uitvoer'.",
  },
  "content-example-carousel": {
    alt: "Voorbeeld van een carrouselpost voor een webshop",
    ratio: "4 / 5",
    brief: "Eerste slide van een carrousel: product + korte hook-tekst ('3 manieren om …').",
  },
  "content-example-lifestyle": {
    alt: "Voorbeeld van een lifestylepost met een product",
    ratio: "4 / 5",
    brief: "Product in gebruik, in een echte omgeving (badkamer, straat, woonkamer).",
  },
  "content-example-ugc": {
    alt: "Voorbeeld van een still uit een UGC-video",
    ratio: "4 / 5",
    brief: "Still uit een UGC-achtige video: persoon houdt product in de camera, ondertitel in beeld.",
  },
  "content-calendar": {
    alt: "Contentkalender met geplande posts voor een webshop",
    ratio: "16 / 10",
    brief: "Laptop of scherm met een maandkalender vol kleine postthumbnails. Mag een mockup/screenshot zijn.",
  },
} satisfies Record<string, MediaSlot>;

export type MediaSlotId = keyof typeof MEDIA_SLOTS;
