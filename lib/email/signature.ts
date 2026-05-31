const SIGN_OFF_PATTERNS = [
  /^kind regards[,.!:\s-]*$/i,
  /^best regards[,.!:\s-]*$/i,
  /^regards[,.!:\s-]*$/i,
  /^sincerely[,.!:\s-]*$/i,
  /^thanks[,.!:\s-]*$/i,
  /^thank you[,.!:\s-]*$/i,
  /^met vriendelijke groet[,.!:\s-]*$/i,
  /^vriendelijke groet[,.!:\s-]*$/i,
  /^vriendelijke groeten[,.!:\s-]*$/i,
  /^hartelijke groet[,.!:\s-]*$/i,
  /^hartelijke groeten[,.!:\s-]*$/i,
  /^met groet[,.!:\s-]*$/i,
  /^groeten[,.!:\s-]*$/i,
  /^groet[,.!:\s-]*$/i,
];

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
    const candidate = lines[i].trim();
    if (SIGN_OFF_PATTERNS.some((pattern) => pattern.test(candidate))) {
      const keptLines = stripTrailingEmptyLines(lines.slice(0, i));
      return keptLines.join("\n").trim();
    }
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

  return `${cleanedBody}\n\n--\n${trimmedSignature}`;
}
