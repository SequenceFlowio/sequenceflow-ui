export function createKnowledgeSnippet(content: string, trimLeadingFragment = false, maxLength = 520) {
  let snippet = content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (trimLeadingFragment) {
    const boundary = snippet.search(/[.!?](?:\s+|\n)|\n{2,}/);
    if (boundary >= 0 && boundary < Math.min(180, Math.floor(snippet.length / 2))) {
      const rest = snippet.slice(boundary + 1).trim();
      if (rest.length >= 40) snippet = rest;
    }
  }

  if (snippet.length <= maxLength) return snippet;
  const shortened = snippet.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(shortened.lastIndexOf(". "), shortened.lastIndexOf("! "), shortened.lastIndexOf("? "));
  const wordEnd = shortened.lastIndexOf(" ");
  const end = sentenceEnd >= Math.floor(maxLength * 0.55) ? sentenceEnd + 1 : wordEnd;
  return `${shortened.slice(0, Math.max(1, end)).trim()}…`;
}
