export function commerceEventRetryDelayMs(attempt: number) {
  return Math.min(60 * 60 * 1000, 60 * 1000 * (2 ** Math.max(0, attempt - 1)));
}
