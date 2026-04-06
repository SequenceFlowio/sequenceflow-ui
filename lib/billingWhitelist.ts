const AGENCY_WHITELIST: string[] = [
  // "sequenceflownl@gmail.com", // temporarily removed for trial testing
];

export function isAgencyWhitelistedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return AGENCY_WHITELIST.includes(normalized);
}

