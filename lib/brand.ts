export const COMPANY_NAME = "SequenceFlow";
export const SUITE_NAME = "Commerce";
export const PRODUCT_NAME = "Support";
export const FULL_PRODUCT_NAME = `${COMPANY_NAME} ${SUITE_NAME} ${PRODUCT_NAME}`;
export const DEFAULT_APP_ORIGIN = "https://support.sequenceflow.io";
export const LEGACY_APP_ORIGIN = "https://emailreply.sequenceflow.io";

export function configuredAppOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || DEFAULT_APP_ORIGIN
  ).replace(/\/$/, "");
}

export function requestAppOrigin(requestUrl: string) {
  const configured = configuredAppOrigin();

  try {
    const requestOrigin = new URL(requestUrl).origin;
    const requestHost = new URL(requestOrigin).hostname;
    const configuredOrigin = new URL(configured).origin;
    const trustedHosts = new Set([
      new URL(DEFAULT_APP_ORIGIN).hostname,
      new URL(LEGACY_APP_ORIGIN).hostname,
      new URL(configuredOrigin).hostname,
      "localhost",
      "127.0.0.1",
    ]);

    return trustedHosts.has(requestHost) ? requestOrigin : configuredOrigin;
  } catch {
    return configured;
  }
}
