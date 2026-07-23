export const KNOWLEDGE_CANDIDATE_THRESHOLD = 0.35;
export const KNOWLEDGE_SEMANTIC_THRESHOLD = 0.5;

const SEARCH_STOP_WORDS = new Set([
  "aan", "als", "bij", "dan", "dat", "de", "den", "der", "dit", "een", "en", "for",
  "from", "heb", "het", "hoe", "ik", "in", "is", "je", "kan", "met", "mijn", "of",
  "om", "op", "the", "to", "van", "voor", "waar", "wanneer", "wat", "wie", "with",
  "zit",
]);

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL");
}

function meaningfulSearchTokens(query: string) {
  return normalizeSearchText(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 4 && !SEARCH_STOP_WORDS.has(token));
}

export function isKnowledgeMatchRelevant(
  query: string,
  row: { content: string; similarity: number | null },
  document: { title: string; source: string | null },
) {
  if ((row.similarity ?? 0) >= KNOWLEDGE_SEMANTIC_THRESHOLD) return true;
  const tokens = meaningfulSearchTokens(query);
  if (tokens.length === 0) return false;
  const searchable = normalizeSearchText(
    [document.title, document.source ?? "", row.content].join(" "),
  );
  return tokens.some((token) => searchable.includes(token));
}
