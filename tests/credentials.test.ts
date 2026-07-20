import assert from "node:assert/strict";
import test from "node:test";

import { decryptSecret, encryptSecret } from "../lib/security/credentials.ts";

test("commerce credentials use authenticated encryption", () => {
  const previousCommerceKey = process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY;
  const previousSmtpKey = process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY;
  process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY = "must-not-be-used-for-commerce";
  try {
    const encrypted = encryptSecret("highly-sensitive-client-secret");
    assert.equal(encrypted.includes("highly-sensitive-client-secret"), false);
    assert.equal(decryptSecret(encrypted), "highly-sensitive-client-secret");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
    assert.throws(() => decryptSecret(tampered));
  } finally {
    if (previousCommerceKey === undefined) delete process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY = previousCommerceKey;
    if (previousSmtpKey === undefined) delete process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY = previousSmtpKey;
  }
});

test("commerce credentials never fall back to the SMTP encryption key", () => {
  const previousCommerceKey = process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY;
  const previousSmtpKey = process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY;
  delete process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY;
  process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY = "smtp-only-secret";
  try {
    assert.throws(() => encryptSecret("commerce-secret"), /COMMERCE_CREDENTIAL_ENCRYPTION_KEY/);
  } finally {
    if (previousCommerceKey === undefined) delete process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.COMMERCE_CREDENTIAL_ENCRYPTION_KEY = previousCommerceKey;
    if (previousSmtpKey === undefined) delete process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.SMTP_CREDENTIAL_ENCRYPTION_KEY = previousSmtpKey;
  }
});
