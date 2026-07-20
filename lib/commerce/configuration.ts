const REQUIRED_COMMERCE_SECRETS = [
  "COMMERCE_CREDENTIAL_ENCRYPTION_KEY",
  "COMMERCE_IDENTITY_HMAC_KEY",
] as const;

export function commerceConfigurationIssue(env: Record<string, string | undefined> = process.env) {
  const missing = REQUIRED_COMMERCE_SECRETS.filter((name) => !env[name]?.trim());
  return missing.length
    ? `Commerce configuration is missing: ${missing.join(", ")}.`
    : null;
}
