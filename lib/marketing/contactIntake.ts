/**
 * Keuzes van de vragenlijst op /nl/contact en /en/contact. Eén lijst voor het
 * formulier en de API, zodat de server alleen antwoorden accepteert die we
 * zelf aanbieden. `label` is Nederlands (ook in de mail naar ons), `en` is
 * wat Engelse bezoekers zien.
 */

export const WHATSAPP_NUMBER = "31619560905";
export const WHATSAPP_DISPLAY = "+31 6 19560905";
export const whatsappLink = (text = "Hoi SequenceFlow, ik heb een vraag over Support One.") =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export const CONTACT_INTAKE = {
  goals: [
    { id: "try", label: "Support One uitproberen", hint: "Zien wat Seffy en Otis voor mijn winkel doen", en: { label: "Try Support One", hint: "See what Seffy and Otis do for my store" } },
    { id: "meet", label: "Een kennismaking", hint: "Twintig minuten online sparren", en: { label: "An intro call", hint: "Twenty minutes online" } },
    { id: "setup", label: "Hulp bij het inrichten", hint: "Mailbox en webshop samen koppelen", en: { label: "Help with setup", hint: "Connect mailbox and store together" } },
    { id: "pricing", label: "Prijzen of facturen", hint: "Welk pakket past, of een vraag over je factuur", en: { label: "Pricing or invoices", hint: "Which plan fits, or a question about your invoice" } },
    { id: "other", label: "Iets anders", hint: "Vertel het ons in stap 3", en: { label: "Something else", hint: "Tell us in step 3" } },
  ],
  platforms: [
    { id: "shopify", label: "Shopify", en: { label: "Shopify" } },
    { id: "woocommerce", label: "WooCommerce", en: { label: "WooCommerce" } },
    { id: "bol", label: "bol", en: { label: "bol" } },
    { id: "lightspeed", label: "Lightspeed", en: { label: "Lightspeed" } },
    { id: "other", label: "Iets anders", en: { label: "Something else" } },
  ],
  volumes: [
    { id: "lt10", label: "Minder dan 10", en: { label: "Fewer than 10" } },
    { id: "10-50", label: "10 tot 50", en: { label: "10 to 50" } },
    { id: "50-200", label: "50 tot 200", en: { label: "50 to 200" } },
    { id: "gt200", label: "Meer dan 200", en: { label: "More than 200" } },
  ],
  reach: [
    { id: "email", label: "E-mail", en: { label: "Email" } },
    { id: "whatsapp", label: "WhatsApp", en: { label: "WhatsApp" } },
    { id: "call", label: "Bellen", en: { label: "Phone call" } },
  ],
} as const;

export const WHATSAPP_TEXT_EN = "Hi SequenceFlow, I have a question about Support One.";
