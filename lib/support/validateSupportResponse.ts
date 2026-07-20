import type { SupportGenerateResponse } from "@/types/support";

export function validateSupportResponse(
  data: unknown
): SupportGenerateResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response: not an object.");
  }

  const response = data as Record<string, unknown>;

  if (typeof response.status !== "string" || !["DRAFT_OK", "NEEDS_HUMAN"].includes(response.status)) {
    throw new Error("Invalid response: status incorrect.");
  }

  if (typeof response.confidence !== "number") {
    throw new Error("Invalid response: confidence must be number.");
  }

  if (!response.draft || typeof response.draft !== "object") {
    throw new Error("Invalid response: draft missing.");
  }

  const draft = response.draft as Record<string, unknown>;
  if (typeof draft.subject !== "string") {
    throw new Error("Invalid response: draft.subject missing.");
  }

  if (typeof draft.body !== "string") {
    throw new Error("Invalid response: draft.body missing.");
  }

  if (!Array.isArray(response.actions)) {
    throw new Error("Invalid response: actions must be array.");
  }

  if (!Array.isArray(response.reasons)) {
    throw new Error("Invalid response: reasons must be array.");
  }

  return data as SupportGenerateResponse;
}
