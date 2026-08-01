import type { LumenChatMessage, LumenSnapshot, LumenSource } from "@/lib/lumen/types";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 4_000;

export function parseLumenMessages(value: unknown): LumenChatMessage[] {
  if (!Array.isArray(value)) throw new Error("Berichten ontbreken.");
  const messages = value.slice(-MAX_MESSAGES).flatMap((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    if (!["user", "assistant"].includes(String(row.role))) return [];
    const content = typeof row.content === "string" ? row.content.trim() : "";
    if (!content || content.length > MAX_MESSAGE_LENGTH) return [];
    return [{ role: row.role as LumenChatMessage["role"], content }];
  });
  if (!messages.length || messages.at(-1)?.role !== "user") {
    throw new Error("Sluit af met een geldige vraag.");
  }
  return messages;
}

export function citedLumenSourceIds(text: string, sources: LumenSource[]) {
  const available = new Set(sources.map((item) => item.id));
  return [...text.matchAll(/\[([a-z0-9-]+)\]/gi)]
    .map((match) => match[1])
    .filter((id, index, all) => available.has(id) && all.indexOf(id) === index);
}

export function buildLumenSuggestions(
  snapshot: Omit<LumenSnapshot, "suggestions">,
  language: "nl" | "en",
) {
  if (language === "en") {
    const suggestions = ["How can I reduce customer questions?"];
    const painPoint = snapshot.painPoints?.items[0];
    if (painPoint) suggestions.push(`How can I reduce ${painPoint.category.toLowerCase()}?`);
    if (snapshot.commerce?.signals[0]) suggestions.push("Which commerce signal should I address first?");
    if (snapshot.support?.topIntents.length) suggestions.push("Which customer question can we prevent most effectively?");
    else suggestions.push("Which data is still missing for a useful analysis?");
    return suggestions.slice(0, 4);
  }

  const suggestions = ["Hoe kan ik voor minder klantvragen zorgen?"];
  const painPoint = snapshot.painPoints?.items[0];
  if (painPoint) suggestions.push(`Hoe kunnen we ${painPoint.category.toLowerCase()} verminderen?`);
  if (snapshot.commerce?.signals[0]) suggestions.push("Welk commerce-signaal moet ik als eerste aanpakken?");
  if (snapshot.support?.topIntents.length) suggestions.push("Welke klantvraag kunnen we het beste voorkomen?");
  else suggestions.push("Welke data ontbreekt nog voor een goede analyse?");
  return suggestions.slice(0, 4);
}
