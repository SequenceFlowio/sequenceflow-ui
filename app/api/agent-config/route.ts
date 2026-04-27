import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { DEFAULT_FROM_EMAIL } from "@/lib/resend";

// ─── GET /api/agent-config ─────────────────────────────────────────────────────

export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: any) {
    const status = err.message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: err.message }, { status });
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("tenant_agent_config")
      .select("empathy_enabled, allow_discount, max_discount_amount, signature, language_default, escalation_departments, autosend_enabled, autosend_threshold, autosend_time_1, autosend_time_2, sender_email, sender_name")
      .eq("tenant_id", tenantId)
      .single();

    if (error || !data) {
      return NextResponse.json({
        tenantId,
        config: {
          empathyEnabled:        true,
          allowDiscount:         false,
          maxDiscountAmount:     null,
          signature:             "",
          languageDefault:       "nl",
          escalationDepartments: [],
          autosendEnabled:       false,
          autosendThreshold:     0.85,
          autosendTime1:         "08:00",
          autosendTime2:         "16:00",
          senderEmail:           DEFAULT_FROM_EMAIL,
          senderName:            "Customer Support",
        },
      });
    }

    return NextResponse.json({
      tenantId,
      config: {
        empathyEnabled:        data.empathy_enabled,
        allowDiscount:         data.allow_discount,
        maxDiscountAmount:     data.max_discount_amount ?? null,
        signature:             data.signature ?? "",
        escalationDepartments: data.escalation_departments ?? [],
        autosendEnabled:       data.autosend_enabled   ?? false,
        autosendThreshold:     data.autosend_threshold ?? 0.85,
        autosendTime1:         data.autosend_time_1    ?? "08:00",
        autosendTime2:         data.autosend_time_2    ?? "16:00",
        languageDefault:       data.language_default   ?? "nl",
        senderEmail:           data.sender_email ?? DEFAULT_FROM_EMAIL,
        senderName:            data.sender_name  ?? "Customer Support",
      },
    });
  } catch (err: any) {
    console.error("[agent-config] GET:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST /api/agent-config ────────────────────────────────────────────────────

export async function POST(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: any) {
    const status = err.message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: err.message }, { status });
  }

  try {
    const body     = await req.json();
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("tenant_agent_config")
      .upsert(
        {
          tenant_id:              tenantId,
          empathy_enabled:        body.empathyEnabled        ?? true,
          allow_discount:         body.allowDiscount         ?? false,
          max_discount_amount:    body.maxDiscountAmount      ?? 0,
          signature:              body.signature             ?? "",
          escalation_departments: body.escalationDepartments ?? [],
          autosend_enabled:       body.autosendEnabled       ?? false,
          autosend_threshold:     body.autosendThreshold     ?? 0.85,
          autosend_time_1:        body.autosendTime1          ?? "08:00",
          autosend_time_2:        body.autosendTime2          ?? "16:00",
          language_default:       body.languageDefault        ?? "nl",
          sender_email:           body.senderEmail           ?? DEFAULT_FROM_EMAIL,
          sender_name:            body.senderName            ?? "Customer Support",
          updated_at:             new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );

    if (error) {
      console.error("[agent-config] POST:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mirror the sender identity into the default email channel row so
    // outbound paths that read `tenant_email_channels.outbound_from_email`
    // (conversation approve-send, conversation escalate) stay consistent
    // with the value users edit in Settings. Without this mirror the UI
    // saves correctly but manual replies on the AI-first flow keep going
    // out from the stale channel value.
    if (body.senderEmail || body.senderName) {
      const admin = getSupabaseAdmin();
      const channelPatch: Record<string, string> = { updated_at: new Date().toISOString() };
      if (body.senderEmail) channelPatch.outbound_from_email = String(body.senderEmail).trim();
      if (body.senderName)  channelPatch.outbound_from_name  = String(body.senderName).trim();
      const { error: channelErr } = await admin
        .from("tenant_email_channels")
        .update(channelPatch)
        .eq("tenant_id", tenantId)
        .eq("is_default", true);
      if (channelErr) {
        // Don't fail the save — agent_config is the canonical row and is
        // already written. Log so we can spot drift if it ever happens.
        console.error("[agent-config] channel mirror failed:", channelErr.message);
      }
    }

    // When autosend is disabled, revert any queued tickets back to draft
    if (!body.autosendEnabled) {
      const admin = getSupabaseAdmin();
      await admin
        .from("tickets")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("status", "pending_autosend");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[agent-config] POST:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
