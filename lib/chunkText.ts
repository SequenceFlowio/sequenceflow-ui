export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 200
) {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) return [];

  const safeChunkSize = Math.max(100, chunkSize);
  const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(safeChunkSize / 2)));
  const units = splitIntoUnits(normalized, safeChunkSize);
  const chunks: string[] = [];
  let current: string[] = [];

  for (const unit of units) {
    const candidate = [...current, unit].join("\n\n");
    if (current.length > 0 && candidate.length > safeChunkSize) {
      chunks.push(current.join("\n\n").trim());
      current = trailingOverlap(current, safeOverlap);
      if ([...current, unit].join("\n\n").length > safeChunkSize) current = [];
    }
    current.push(unit);
  }

  if (current.length) chunks.push(current.join("\n\n").trim());
  return chunks.filter((chunk, index) => chunk && chunk !== chunks[index - 1]);
}

function splitIntoUnits(text: string, maxLength: number) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.flatMap((paragraph) => {
    if (paragraph.length <= maxLength) return [paragraph];

    const sentences = paragraph
      .split(/(?<=[.!?])\s+(?=[\p{Lu}\d"'([{•*-])/u)
      .map((part) => part.trim())
      .filter(Boolean);
    if (sentences.length > 1) {
      return sentences.flatMap((sentence) => splitOversizedUnit(sentence, maxLength));
    }
    return splitOversizedUnit(paragraph, maxLength);
  });
}

function splitOversizedUnit(value: string, maxLength: number) {
  if (value.length <= maxLength) return [value];
  const words = value.split(/\s+/);
  const parts: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= maxLength) {
      current += ` ${word}`;
    } else {
      parts.push(current);
      current = word;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function trailingOverlap(units: string[], overlap: number) {
  if (overlap === 0) return [];
  const result: string[] = [];
  let length = 0;
  for (let index = units.length - 1; index >= 0; index--) {
    const nextLength = length + units[index].length + (result.length ? 2 : 0);
    if (result.length && nextLength > overlap) break;
    result.unshift(units[index]);
    length = nextLength;
  }
  return result;
}
