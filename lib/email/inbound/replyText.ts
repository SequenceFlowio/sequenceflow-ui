const QUOTED_HEADER_PATTERNS = [
  /^On .+wrote:\s*$/i,
  /^Op .+schreef .+:\s*$/i,
  /^Am .+schrieb .+:\s*$/i,
  /^Le .+a .crit\s*:\s*$/i,
  /^El .+escribi.:\s*$/i,
  /^-{2,}\s*Original Message\s*-{2,}$/i,
  /^_{5,}$/,
  /^Begin forwarded message:\s*$/i,
];

const HEADER_START_PATTERNS = [
  /^From:\s.+/i,
  /^Van:\s.+/i,
  /^De:\s.+/i,
  /^Sent:\s.+/i,
  /^Verzonden:\s.+/i,
  /^To:\s.+/i,
  /^Aan:\s.+/i,
  /^Subject:\s.+/i,
  /^Onderwerp:\s.+/i,
];

function looksLikeSplitGmailQuote(lines: string[], index: number) {
  const line = lines[index]?.trim() ?? "";
  if (!/^On .+/i.test(line) && !/^Op .+/i.test(line)) return false;

  const window = lines.slice(index, index + 4).join(" ");
  return /\bwrote:\s*$/i.test(window) || /\bschreef\s*:?\s*$/i.test(window);
}

function findQuoteStart(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (QUOTED_HEADER_PATTERNS.some((pattern) => pattern.test(line))) {
      return index;
    }

    if (looksLikeSplitGmailQuote(lines, index)) {
      return index;
    }

    if (
      HEADER_START_PATTERNS.some((pattern) => pattern.test(line)) &&
      lines.slice(index, index + 5).filter((candidate) =>
        HEADER_START_PATTERNS.some((pattern) => pattern.test(candidate.trim()))
      ).length >= 2
    ) {
      return index;
    }
  }

  return -1;
}

function trimBlankEdges(lines: string[]) {
  let start = 0;
  let end = lines.length;

  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;

  return lines.slice(start, end);
}

export function extractVisibleReplyText(input: string | null | undefined) {
  const original = String(input ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!original) return "";

  const lines = original.split("\n");
  const quoteStart = findQuoteStart(lines);
  const candidateLines = quoteStart >= 0 ? lines.slice(0, quoteStart) : lines;
  const unquotedLines = candidateLines.filter((line) => !line.trimStart().startsWith(">"));
  const cleaned = trimBlankEdges(unquotedLines).join("\n").trim();

  return cleaned || original;
}
