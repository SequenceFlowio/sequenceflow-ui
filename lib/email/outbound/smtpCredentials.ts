import crypto from "crypto";

const PREFIX = "v1";

function getEncryptionKey() {
  const secret = process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error("SMTP_CREDENTIAL_ENCRYPTION_KEY is not configured.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSmtpPassword(password: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSmtpPassword(encryptedValue: string) {
  const [version, ivRaw, tagRaw, dataRaw] = encryptedValue.split(":");
  if (version !== PREFIX || !ivRaw || !tagRaw || !dataRaw) {
    throw new Error("Unsupported SMTP credential format.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
