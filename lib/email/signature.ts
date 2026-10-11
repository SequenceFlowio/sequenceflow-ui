/**
 * Closing lines the model sometimes writes despite the prompt ("Groetjes!",
 * "Best regards,"). The configured signature is the only sign-off a reply gets.
 */
const SIGN_OFFS = new Set([
  // English
  "kind regards", "best regards", "warm regards", "warmest regards", "kindest regards", "regards", "best wishes",
  "all the best", "best", "cheers", "sincerely", "yours sincerely", "yours truly", "thanks", "thank you",
  "many thanks", "thanks again", "thanks so much", "take care", "have a great day", "have a nice day",
  // Dutch
  "met vriendelijke groet", "met vriendelijke groeten", "vriendelijke groet", "vriendelijke groeten",
  "hartelijke groet", "hartelijke groeten", "warme groet", "warme groeten", "met groet", "met groeten",
  "groet", "groeten", "groetjes", "liefs", "mvg", "gr", "fijne dag", "fijne dag nog", "nog een fijne dag",
  "een fijne dag nog", "bedankt", "alvast bedankt", "dank je wel", "dankjewel", "dank u wel",
  // German, French, Spanish
  "mit freundlichen grüßen", "freundliche grüße", "viele grüße", "liebe grüße", "beste grüße", "herzliche grüße",
  "cordialement", "bien cordialement", "bien à vous", "meilleures salutations",
  "saludos", "un saludo", "saludos cordiales", "atentamente",
]);

function isSignOffLine(line: string) {
  const normalized = line.trim().toLowerCase()
    .replace(/[\s,.!:;~\-–—]+$/u, "")
    .replace(/[\p{Extended_Pictographic}\uFE0F]+/gu, "")
    .replace(/[\s,.!:;~\-–—]+$/u, "")
    .replace(/\s+/g, " ");
  return SIGN_OFFS.has(normalized);
}

function stripTrailingEmptyLines(lines: string[]) {
  const result = [...lines];
  while (result.length > 0 && !result[result.length - 1].trim()) {
    result.pop();
  }
  return result;
}

function normalizeLine(line: string) {
  return line.trim().replace(/\s+/g, " ").toLowerCase();
}

function stripTrailingSignatureDelimiter(lines: string[]) {
  const searchStart = Math.max(0, lines.length - 10);
  for (let i = lines.length - 1; i >= searchStart; i -= 1) {
    if (/^--\s*$/.test(lines[i].trim())) {
      return stripTrailingEmptyLines(lines.slice(0, i));
    }
  }
  return lines;
}

function stripTrailingSignOff(body: string) {
  const lines = stripTrailingSignatureDelimiter(stripTrailingEmptyLines(body.split(/\r?\n/)));
  const searchStart = Math.max(0, lines.length - 8);

  for (let i = searchStart; i < lines.length; i += 1) {
    if (!isSignOffLine(lines[i])) continue;
    // Only a real closing: at most a short name or team line may follow it.
    const after = lines.slice(i + 1).filter((line) => line.trim());
    if (after.length > 3 || after.some((line) => line.trim().length > 60)) continue;
    return stripTrailingEmptyLines(lines.slice(0, i)).join("\n").trim();
  }

  return lines.join("\n").trim();
}

function stripConfiguredSignatureTail(body: string, signature: string) {
  const bodyLines = stripTrailingEmptyLines(body.split(/\r?\n/));
  const signatureLines = stripTrailingEmptyLines(signature.split(/\r?\n/));
  const maxOverlap = Math.min(bodyLines.length, signatureLines.length);

  for (let count = maxOverlap; count >= 2; count -= 1) {
    const bodyTail = bodyLines.slice(-count).map(normalizeLine).join("\n");
    const signatureTail = signatureLines.slice(-count).map(normalizeLine).join("\n");
    if (bodyTail && bodyTail === signatureTail) {
      return stripTrailingEmptyLines(bodyLines.slice(0, -count)).join("\n").trim();
    }
  }

  return bodyLines.join("\n").trim();
}

export function appendConfiguredSignature(body: string, signature: string) {
  const trimmedSignature = signature.trim();
  let cleanedBody = stripTrailingSignOff(body).trim();

  if (!trimmedSignature) {
    return cleanedBody;
  }

  const normalizedBody = cleanedBody.toLowerCase();
  const normalizedSignature = trimmedSignature.toLowerCase();
  const signatureIndex = normalizedBody.lastIndexOf(normalizedSignature);

  if (signatureIndex >= 0 && signatureIndex > cleanedBody.length / 2) {
    cleanedBody = cleanedBody.slice(0, signatureIndex).trim();
  }

  cleanedBody = stripConfiguredSignatureTail(cleanedBody, trimmedSignature);
  cleanedBody = stripTrailingSignOff(cleanedBody).trim();

  if (!cleanedBody) {
    return trimmedSignature;
  }

  return `${cleanedBody}\n\n${trimmedSignature}`;
}
