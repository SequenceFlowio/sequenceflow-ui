const AGENCY_WHITELIST: string[] = [
  "sequenceflownl@gmail.com",
];

export function isAgencyWhitelistedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return AGENCY_WHITELIST.includes(normalized);
}

