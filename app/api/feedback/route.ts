import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getResendClient } from "@/lib/email/outbound/resendClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const { text } = await req.json() as { text?: string };

    if (!text?.trim()) {
      return NextResponse.json({ error: "Feedback text is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();

    const resend = getResendClient();
    await resend.emails.send({
      from: "SequenceFlow <noreply@mail.sequenceflow.io>",
      to: "hallo@sequenceflow.io",
      subject: `Feedback van tenant ${tenantId}`,
      text: `Van: ${profile?.email ?? "onbekend"}\nTenant: ${tenantId}\n\n${text.trim()}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback]", err);
    return NextResponse.json({ error: "Failed to send feedback" }, { status: 500 });
  }
}
