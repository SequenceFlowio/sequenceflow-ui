/**
 * Meetcodes van de website. Geen geheimen: ze staan in de broncode van elke
 * pagina. Een waarde in Vercel gaat voor; NEXT_PUBLIC_GTM_ID=off of
 * NEXT_PUBLIC_META_PIXEL_ID=off zet die uit.
 */
const DEFAULT_GTM_ID = "GTM-T624SDZZ";

function gtmId(value: string | undefined) {
  const id = (value ?? DEFAULT_GTM_ID).trim();
  return /^GTM-[A-Z0-9]+$/.test(id) ? id : "";
}

/** Google Tag Manager-container; GA4 en andere tags worden in de container zelf beheerd. */
export const GTM_ID = gtmId(process.env.NEXT_PUBLIC_GTM_ID);

/** Meta-pixel (dataset "SequenceFlow website" in Events Manager, aangemaakt 25 nov 2026). */
const DEFAULT_META_PIXEL_ID = "1965542234424125";

function pixelId(value: string | undefined) {
  const id = (value ?? DEFAULT_META_PIXEL_ID).trim();
  return /^\d{10,20}$/.test(id) ? id : "";
}

export const META_PIXEL_ID = pixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
