export type ChatScope = "general" | "mail";
export function parseChatScope(value: unknown): ChatScope {
  if (value === undefined || value === "general") return "general";
  if (value === "mail") return "mail";
  throw new Error("Unknown chat scope");
}
export function parseChatConversation(scope: ChatScope, value: unknown): string | null {
  if (value == null) return null;
  if (scope !== "mail" || typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("Invalid conversation context");
  return value;
}
