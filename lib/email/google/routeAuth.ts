import { NextResponse } from "next/server";

import { authorizationErrorResponse } from "@/lib/auth/authorization";
import { getTenantId, type TenantContext } from "@/lib/tenant";

/** Only workspace admins connect or disconnect the mailbox. */
export async function requireMailboxAdmin(req: Request): Promise<TenantContext | NextResponse> {
  try {
    const context = await getTenantId(req);
    if (context.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    return context;
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
}
