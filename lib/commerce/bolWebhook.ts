import crypto from "node:crypto";

export type BolSignature = {
  keyId: string;
  algorithm: string;
  signature: string;
};

export type NormalizedBolEvent = {
  retailerId: string;
  timestamp: string;
  resource: string;
  resourceId: string;
  eventType: string | null;
};

export function bolEventId(event: NormalizedBolEvent) {
  return crypto.createHash("sha256").update(JSON.stringify([
    event.retailerId,
    event.timestamp,
    event.resource,
    event.resourceId,
    event.eventType,
  ])).digest("hex");
}

export function normalizeBolEvent(value: unknown): NormalizedBolEvent | null {
  if (!value || typeof value !== "object") return null;
  const envelope = value as Record<string, unknown>;
  const nested = envelope.event && typeof envelope.event === "object"
    ? envelope.event as Record<string, unknown>
    : envelope;
  const retailerId = String(envelope.retailerId ?? "").trim();
  const resource = String(nested.resource ?? "").trim().toUpperCase();
  const resourceId = String(nested.resourceId ?? "").trim();
  const timestamp = String(envelope.timestamp ?? "").trim();
  if (!retailerId || !resource || !resourceId || !timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  return {
    retailerId,
    timestamp,
    resource,
    resourceId,
    eventType: typeof nested.type === "string" ? nested.type : null,
  };
}

export function parseBolSignature(value: string | null): BolSignature | null {
  if (!value) return null;
  const fields = Object.fromEntries(value.split(",").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=").trim().replace(/^"|"$/g, "")];
  }));
  if (!fields.keyId || !fields.algorithm || !fields.signature) return null;
  return { keyId: fields.keyId, algorithm: fields.algorithm.toLowerCase(), signature: fields.signature };
}

export function verifyBolSignature(rawBody: string, signatureHeader: string | null, publicKeyBase64: string) {
  const signature = parseBolSignature(signatureHeader);
  if (!signature || signature.algorithm !== "rsa-sha256") return false;
  try {
    const key = Buffer.from(publicKeyBase64, "base64");
    let publicKey: crypto.KeyObject;
    try {
      publicKey = crypto.createPublicKey({ key, format: "der", type: "spki" });
    } catch {
      publicKey = new crypto.X509Certificate(key).publicKey;
    }
    return crypto.verify("RSA-SHA256", Buffer.from(rawBody, "utf8"), publicKey, Buffer.from(signature.signature, "base64"));
  } catch {
    return false;
  }
}
