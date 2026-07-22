import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { DEFAULT_FROM_EMAIL } from "@/lib/resend";
import { getErrorMessage } from "@/lib/errors";

// ─── GET /api/agent-config ─────────────────────────────────────────────────────

export async function GET(req: Request) {
  let tenantId: string;
  let canManage = false;
  try {
    const context = await getTenantId(req);
    tenantId = context.tenantId;
    canManage = context.role === "admin";
  } catch (err: unknown) {
    const message = getErrorMessage(err, "Forbidden");
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("tenant_agent_config")
      .select("empathy_enabled, allow_discount, max_discount_amount, signature, language_default, reply_tone, reply_pronoun_preference, escalation_departments, autosend_enabled, autosend_threshold, autosend_time_1, autosend_time_2, sender_email, sender_name")
      .eq("tenant_id", tenantId)
      .single();

    if (error || !data) {
      return NextResponse.json({
        tenantId,
        permissions: { canManage },
        config: {
          empathyEnabled:        true,
          allowDiscount:         false,
          maxDiscountAmount:     null,
          signature:             "",
          languageDefault:       "nl",
          replyTone:             "friendly_informal",
          replyPronounPreference:"informal",
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
      permissions: { canManage },
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
        replyTone:             data.reply_tone         ?? "friendly_informal",
        replyPronounPreference:data.reply_pronoun_preference ?? "informal",
        senderEmail:           data.sender_email ?? DEFAULT_FROM_EMAIL,
        senderName:            data.sender_name  ?? "Customer Support",
      },
    });
  } catch (err: unknown) {
    console.error("[agent-config] GET:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

// ─── POST /api/agent-config ────────────────────────────────────────────────────

export async function POST(req: Request) {
  let tenantId: string;
  try {
    const context = await getTenantId(req);
    if (context.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    tenantId = context.tenantId;
  } catch (err: unknown) {
    const message = getErrorMessage(err, "Forbidden");
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const body     = await req.json();
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from("tenant_agent_config")
      .select("empathy_enabled, allow_discount, max_discount_amount, signature, language_default, reply_tone, reply_pronoun_preference, escalation_departments, autosend_enabled, autosend_threshold, autosend_time_1, autosend_time_2, sender_email, sender_name")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const existingConfig = existing as Record<string, unknown> | null;
    const requestBody = body as Record<string, unknown>;
    const keep = <T,>(key: string, column: string, fallback: T): T =>
      requestBody[key] !== undefined ? requestBody[key] as T : (existingConfig?.[column] as T ?? fallback);

    const signature = keep("signature", "signature", "");
    const allowDiscount = keep("allowDiscount", "allow_discount", false);
    const maxDiscountAmount = keep<number | null>("maxDiscountAmount", "max_discount_amount", null);
    const autosendThreshold = keep("autosendThreshold", "autosend_threshold", 0.85);
    const autosendTime1 = keep("autosendTime1", "autosend_time_1", "08:00");
    const autosendTime2 = keep("autosendTime2", "autosend_time_2", "16:00");
    let escalationDepartments = keep<Array<{ name: string; email: string }>>("escalationDepartments", "escalation_departments", []);
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

    if (requestBody.signature !== undefined && !String(signature).trim()) {
      return NextResponse.json({ error: "Signature is required", field: "signature" }, { status: 400 });
    }
    if (allowDiscount && (typeof maxDiscountAmount !== "number" || !Number.isFinite(maxDiscountAmount) || maxDiscountAmount < 0)) {
      return NextResponse.json({ error: "Maximum discount must be a positive amount", field: "maxDiscountAmount" }, { status: 400 });
    }
    if (typeof autosendThreshold !== "number" || !Number.isFinite(autosendThreshold) || autosendThreshold < 0.5 || autosendThreshold > 1) {
      return NextResponse.json({ error: "Autosend threshold must be between 0.5 and 1", field: "autosendThreshold" }, { status: 400 });
    }
    if (!timePattern.test(String(autosendTime1)) || !timePattern.test(String(autosendTime2))) {
      return NextResponse.json({ error: "Autosend times must use HH:MM", field: "autosendTime1" }, { status: 400 });
    }
    if (!['nl', 'en', 'de', 'fr'].includes(String(keep("languageDefault", "language_default", "nl")))) {
      return NextResponse.json({ error: "Invalid fallback language", field: "languageDefault" }, { status: 400 });
    }
    if (!['friendly_informal', 'professional', 'warm', 'concise'].includes(String(keep("replyTone", "reply_tone", "friendly_informal")))) {
      return NextResponse.json({ error: "Invalid reply tone", field: "replyTone" }, { status: 400 });
    }
    if (!['informal', 'formal'].includes(String(keep("replyPronounPreference", "reply_pronoun_preference", "informal")))) {
      return NextResponse.json({ error: "Invalid pronoun preference", field: "replyPronounPreference" }, { status: 400 });
    }
    if (requestBody.escalationDepartments !== undefined) {
      if (!Array.isArray(requestBody.escalationDepartments)) {
        return NextResponse.json({ error: "Escalation departments must be a list", field: "escalationDepartments" }, { status: 400 });
      }
      escalationDepartments = requestBody.escalationDepartments.map((department) => ({
        name: typeof department?.name === "string" ? department.name.trim() : "",
        email: typeof department?.email === "string" ? department.email.trim().toLowerCase() : "",
      }));
      const names = new Set<string>();
      const emails = new Set<string>();
      for (const department of escalationDepartments) {
        const normalizedName = department.name.toLowerCase();
        if (!department.name || !/^\S+@\S+\.\S+$/.test(department.email) || names.has(normalizedName) || emails.has(department.email)) {
          return NextResponse.json({ error: "Escalation departments must be unique and valid", field: "escalationDepartments" }, { status: 400 });
        }
        names.add(normalizedName);
        emails.add(department.email);
      }
    }

    const { error } = await supabase
      .from("tenant_agent_config")
      .upsert(
        {
          tenant_id:              tenantId,
          empathy_enabled:        keep("empathyEnabled", "empathy_enabled", true),
          allow_discount:         allowDiscount,
          max_discount_amount:    maxDiscountAmount ?? 0,
          signature,
          escalation_departments: escalationDepartments,
          autosend_enabled:       keep("autosendEnabled", "autosend_enabled", false),
          autosend_threshold:     autosendThreshold,
          autosend_time_1:        autosendTime1,
          autosend_time_2:        autosendTime2,
          language_default:       keep("languageDefault", "language_default", "nl"),
          reply_tone:             keep("replyTone", "reply_tone", "friendly_informal"),
          reply_pronoun_preference: keep("replyPronounPreference", "reply_pronoun_preference", "informal"),
          sender_email:           keep("senderEmail", "sender_email", DEFAULT_FROM_EMAIL),
          sender_name:            keep("senderName", "sender_name", "Customer Support"),
          updated_at:             new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );

    if (error) {
      console.error("[agent-config] POST:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mirror only the sender NAME into the default email channel — never
    // the email. The channel's outbound_from_email must remain a
    // Resend-verified address (currently `reply@inbox.emailreply.sequenceflow.io`),
    // because that's the literal value Resend sends `From:` from. Letting
    // settings push an arbitrary user-typed email into that column means
    // the next outbound send fails with "domain not verified". Custom
    // from-domains belong in a future flow that runs Resend domain
    // verification; until then, sender_email in agent_config is for
    // display only.
    if (body.senderName) {
      const admin = getSupabaseAdmin();
      const { error: channelErr } = await admin
        .from("tenant_email_channels")
        .update({
          outbound_from_name: String(body.senderName).trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("is_default", true);
      if (channelErr) {
        console.error("[agent-config] channel name mirror failed:", channelErr.message);
      }
    }

    // When autosend is disabled, revert any queued tickets back to draft
    if (body.autosendEnabled === false) {
      const admin = getSupabaseAdmin();
      await admin
        .from("tickets")
        .update({ status: "draft", scheduled_send_at: null, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("status", "pending_autosend");
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[agent-config] POST:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
