import crypto from "crypto";

type TenantIdentity = {
  tenantId: string;
  role: string;
  userId: string;
};

export class AuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(
    message: string,
    status: 401 | 403 = 403
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

export function requireRole(context: TenantIdentity, allowedRoles: readonly string[]) {
  if (!allowedRoles.includes(context.role)) {
    throw new AuthorizationError("Forbidden: insufficient role", 403);
  }
  return context;
}

export function resolveTenantScope(
  context: TenantIdentity,
  requestedTenantId?: unknown,
  options: { allowOverride?: boolean } = {}
) {
  const requested = typeof requestedTenantId === "string"
    ? requestedTenantId.trim().replace(/^=+/, "")
    : "";

  if (!requested) return context.tenantId;
  if (requested === context.tenantId) return context.tenantId;
  if (options.allowOverride) return requested;

  throw new AuthorizationError("Forbidden: tenant scope mismatch", 403);
}

export function hasValidInternalSecret(
  req: Request,
  envSecret = process.env.INTERNAL_API_SECRET ?? process.env.CRON_SECRET
) {
  const supplied = req.headers.get("x-internal-secret") ?? "";
  if (!envSecret || !supplied) return false;

  const expectedBuffer = Buffer.from(envSecret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function authorizationErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return { message: error.message, status: error.status };
  }

  const message = error instanceof Error ? error.message : "Forbidden";
  return {
    message,
    status: message === "Not authenticated" ? 401 as const : 403 as const,
  };
}
