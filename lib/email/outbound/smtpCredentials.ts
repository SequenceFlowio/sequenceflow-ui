import crypto from "crypto";

const PREFIX = "v1";

function getEncryptionKey(name: "SMTP_CREDENTIAL_ENCRYPTION_KEY" | "COMMERCE_CREDENTIAL_ENCRYPTION_KEY") {
  const secret = process.env[name]?.trim();
  if (!secret) throw new Error(`${name} is not configured.`);
  return crypto.createHash("sha256").update(secret).digest();
}

function decryptWithKey(encryptedValue: string, key: Buffer) {
  const [version, ivRaw, tagRaw, dataRaw] = encryptedValue.split(":");
  if (version !== PREFIX || !ivRaw || !tagRaw || !dataRaw) {
    throw new Error("Unsupported SMTP credential format.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptSmtpPassword(password: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getEncryptionKey("SMTP_CREDENTIAL_ENCRYPTION_KEY"),
    iv
  );
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
  try {
    return decryptWithKey(
      encryptedValue,
      getEncryptionKey("SMTP_CREDENTIAL_ENCRYPTION_KEY")
    );
  } catch (smtpError) {
    // Credentials saved during the commerce v1 release used the commerce key.
    // Keep that short-lived format readable while all new email credentials
    // continue to use their dedicated SMTP key.
    try {
      return decryptWithKey(
        encryptedValue,
        getEncryptionKey("COMMERCE_CREDENTIAL_ENCRYPTION_KEY")
      );
    } catch {
      throw smtpError;
    }
  }
}
