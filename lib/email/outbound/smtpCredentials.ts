import { decryptSecret, encryptSecret } from "@/lib/security/credentials";

export function encryptSmtpPassword(password: string) {
  return encryptSecret(password);
}

export function decryptSmtpPassword(encryptedValue: string) {
  return decryptSecret(encryptedValue);
}
