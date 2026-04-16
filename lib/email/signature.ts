const SIGN_OFF_PATTERNS = [
  /^kind regards[,.!:\s-]*$/i,
  /^best regards[,.!:\s-]*$/i,
  /^regards[,.!:\s-]*$/i,
  /^sincerely[,.!:\s-]*$/i,
  /^met vriendelijke groet[,.!:\s-]*$/i,
  /^vriendelijke groet[,.!:\s-]*$/i,
  /^met groet[,.!:\s-]*$/i,
  /^groeten[,.!:\s-]*$/i,
];

function stripTrailingEmptyLines(lines: string[]) {
  const result = [...lines];
  while (result.length > 0 && !result[result.length - 1].trim()) {
    result.pop();
  }
  return result;
}

function stripTrailingSignOff(body: string) {
  const lines = stripTrailingEmptyLines(body.split(/\r?\n/));
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

  if (!cleanedBody) {
    return trimmedSignature;
  }

  return `${cleanedBody}\n\n--\n${trimmedSignature}`;
}
