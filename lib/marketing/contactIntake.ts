/**
 * Keuzes van de vragenlijst op /contact. Eén lijst voor het formulier en de
 * API, zodat de server alleen antwoorden accepteert die we zelf aanbieden.
 */

export const WHATSAPP_NUMBER = "31619560905";
export const WHATSAPP_DISPLAY = "+31 6 19560905";
export const whatsappLink = (text = "Hoi SequenceFlow, ik heb een vraag over Support One.") =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export const CONTACT_INTAKE = {
  goals: [
    { id: "try", label: "Support One uitproberen", hint: "Zien wat Seffy en Otis voor mijn winkel doen" },
    { id: "meet", label: "Een kennismaking", hint: "Twintig minuten online sparren" },
    { id: "setup", label: "Hulp bij het inrichten", hint: "Mailbox en webshop samen koppelen" },
    { id: "pricing", label: "Prijzen of facturen", hint: "Welk pakket past, of een vraag over je factuur" },
    { id: "other", label: "Iets anders", hint: "Vertel het ons in stap 3" },
  ],
  platforms: [
    { id: "shopify", label: "Shopify" },
    { id: "woocommerce", label: "WooCommerce" },
    { id: "bol", label: "bol" },
    { id: "lightspeed", label: "Lightspeed" },
    { id: "other", label: "Iets anders" },
  ],
  volumes: [
    { id: "lt10", label: "Minder dan 10" },
    { id: "10-50", label: "10 tot 50" },
    { id: "50-200", label: "50 tot 200" },
    { id: "gt200", label: "Meer dan 200" },
  ],
  reach: [
    { id: "email", label: "E-mail" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "call", label: "Bellen" },
  ],
} as const;
