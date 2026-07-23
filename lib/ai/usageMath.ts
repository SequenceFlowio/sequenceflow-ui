export type CompletionUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  } | null;
} | null | undefined;

export function aiCreditUsage(usage: CompletionUsage) {
  const promptTokens = Math.max(0, Number(usage?.prompt_tokens ?? 0));
  const cachedInputTokens = Math.min(
    promptTokens,
    Math.max(0, Number(usage?.prompt_tokens_details?.cached_tokens ?? 0)),
  );
  const completionTokens = Math.max(0, Number(usage?.completion_tokens ?? 0));
  const uncachedInputTokens = promptTokens - cachedInputTokens;
  const weightedTokens =
    uncachedInputTokens +
    Math.ceil(cachedInputTokens * 0.25) +
    completionTokens * 3;

  return {
    promptTokens,
    cachedInputTokens,
    completionTokens,
    weightedTokens,
    credits: weightedTokens > 0 ? Math.ceil(weightedTokens / 1000) : 0,
  };
}
