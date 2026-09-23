export type AiProviderIssue = "billing" | "rate_limit" | "configuration";

export function classifyAiProviderIssue(error: unknown): AiProviderIssue | null {
  if (!error || typeof error !== "object") return null;
  const response = error as { code?: unknown; status?: unknown; message?: unknown };
  const code = String(response.code ?? "").toLowerCase();
  const message = String(response.message ?? "").toLowerCase();

  if (code === "credit_balance_exhausted" || code === "insufficient_quota" || message.includes("no credits remaining")) {
    return "billing";
  }
  if (code === "invalid_api_key" || response.status === 401 || message.includes("openai_api_key is missing")) {
    return "configuration";
  }
  if (response.status === 429) return "rate_limit";
  return null;
}

export function aiProviderIssueMessage(issue: AiProviderIssue, language: "nl" | "en") {
  if (language === "en") {
    if (issue === "billing") return "The AI service has no API credit left. Ask an administrator to check the OpenAI billing account.";
    if (issue === "configuration") return "The AI service is not configured correctly. Ask an administrator to check the API key.";
    return "The AI service is busy. Please try again in a few minutes.";
  }
  if (issue === "billing") return "De AI-dienst heeft geen API-tegoed meer. Laat een beheerder de OpenAI-facturatie controleren.";
  if (issue === "configuration") return "De AI-dienst is niet goed ingesteld. Laat een beheerder de API-sleutel controleren.";
  return "De AI-dienst is druk. Probeer het over enkele minuten opnieuw.";
}
