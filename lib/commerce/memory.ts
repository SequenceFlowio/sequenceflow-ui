export function buildPseudonymousCaseMemory(input: {
  rawIntents: unknown[];
  linkedOrderCount: number;
  finalOutcome: string;
}) {
  const intents = [...new Set(input.rawIntents.map((intent) => {
    const label = String(intent ?? "").trim().toLowerCase();
    return /^[a-z][a-z0-9_-]{0,79}$/.test(label) ? label : "general_support";
  }))];
  const finalOutcome = input.finalOutcome.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "case_closed";
  const linkedOrderText = input.linkedOrderCount
    ? `${input.linkedOrderCount} linked order${input.linkedOrderCount === 1 ? "" : "s"}. `
    : "";
  return {
    intents,
    finalOutcome,
    summary: `Support case about ${intents.join(", ") || "general support"}. ${linkedOrderText}Final outcome: ${finalOutcome}.`,
  };
}
