/**
 * Ontbreekt bij de terugkeer van Google de PKCE-cookie (andere host, privacy-
 * instellingen, een oud tabblad), dan herstarten we het inloggen één keer
 * vanzelf in plaats van een foutmelding te tonen. Een tweede mislukking gaat
 * wél naar het inlogscherm, zodat er nooit een lus ontstaat.
 */
export function shouldRetryOAuth(errorMessage: string | null | undefined, alreadyRetried: boolean) {
  if (alreadyRetried || !errorMessage) return false;
  return /code verifier|flow state|flow_state|pkce/i.test(errorMessage);
}
