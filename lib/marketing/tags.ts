/**
 * Meetcodes van de website. Geen geheimen: ze staan in de broncode van elke
 * pagina. Een waarde in Vercel gaat voor; NEXT_PUBLIC_GTM_ID=off zet de
 * container uit.
 */
const DEFAULT_GTM_ID = "GTM-T624SDZZ";

function gtmId(value: string | undefined) {
  const id = (value ?? DEFAULT_GTM_ID).trim();
  return /^GTM-[A-Z0-9]+$/.test(id) ? id : "";
}

/** Google Tag Manager-container; GA4 en andere tags worden in de container zelf beheerd. */
export const GTM_ID = gtmId(process.env.NEXT_PUBLIC_GTM_ID);
