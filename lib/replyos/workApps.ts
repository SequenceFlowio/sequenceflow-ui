export const WORK_APP_TYPES = [
  "mailbox",
  "commerce",
  "crm",
  "helpdesk",
  "shipping",
  "knowledge_base",
  "other",
] as const;

export const WORK_APP_PERMISSION_LEVELS = [
  "read_only",
  "draft_only",
  "submit_allowed",
  "destructive_blocked",
] as const;

export const WORK_APP_RUNTIME_PROVIDERS = [
  "browserbase_openai_cua",
  "local_playwright",
  "manual_watch",
] as const;

export type WorkAppType = (typeof WORK_APP_TYPES)[number];
export type WorkAppPermissionLevel = (typeof WORK_APP_PERMISSION_LEVELS)[number];
export type WorkAppRuntimeProvider = (typeof WORK_APP_RUNTIME_PROVIDERS)[number];

export type ReplyOSWorkApp = {
  id: string;
  appType: WorkAppType;
  provider: string;
  displayName: string;
  baseUrl: string | null;
  status: "setup_required" | "active" | "login_expired" | "needs_mfa" | "paused" | "failed";
  permissionLevel: WorkAppPermissionLevel;
  runtimeProvider: WorkAppRuntimeProvider;
  credentialStatus: "not_configured" | "manual_session" | "stored_reference" | "expired";
  allowedDomains: string[];
  notes: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
};

export type ReplyOSAgentRunSummary = {
  id: string;
  conversationId: string | null;
  workAppId: string | null;
  status: "queued" | "running" | "waiting_for_human" | "ready_to_reply" | "sent" | "failed" | "cancelled";
  objective: string;
  riskLevel: "low" | "medium" | "high" | "blocked";
  runtimeProvider: WorkAppRuntimeProvider;
  currentUrl: string | null;
  finalAnswer: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: ReplyOSAgentStep[];
};

export type ReplyOSAgentStep = {
  id: string;
  stepIndex: number;
  actionType: string;
  status: "recorded" | "blocked" | "failed" | "completed";
  url: string | null;
  summary: string;
  modelDecision: string | null;
  screenshotRef: string | null;
  safetyFlags: unknown[];
  durationMs: number | null;
  createdAt: string;
};

export function isWorkAppType(value: unknown): value is WorkAppType {
  return typeof value === "string" && WORK_APP_TYPES.includes(value as WorkAppType);
}

export function isWorkAppPermissionLevel(value: unknown): value is WorkAppPermissionLevel {
  return typeof value === "string" && WORK_APP_PERMISSION_LEVELS.includes(value as WorkAppPermissionLevel);
}

export function isWorkAppRuntimeProvider(value: unknown): value is WorkAppRuntimeProvider {
  return typeof value === "string" && WORK_APP_RUNTIME_PROVIDERS.includes(value as WorkAppRuntimeProvider);
}

export function normalizeAllowedDomains(baseUrl: string | null, domains: unknown): string[] {
  const rawDomains = Array.isArray(domains) ? domains : [];
  const normalized = rawDomains
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
    .filter(Boolean)
    .map((value) => value.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));

  if (baseUrl) {
    try {
      normalized.unshift(new URL(baseUrl).hostname.toLowerCase());
    } catch {
      // Invalid URLs are rejected by callers; keep this helper defensive.
    }
  }

  return Array.from(new Set(normalized));
}

export function parseHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }
  return parsed.toString();
}
