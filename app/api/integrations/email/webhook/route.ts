/**
 * POST /api/integrations/email/webhook
 *
 * Receives inbound emails from Resend (or any compatible inbound email service).
 * Each tenant has a unique forwarding address:
 *   t-{tenantId}@inbox.emailreply.sequenceflow.io
 *
 * Flow:
 *  1. Parse inbound payload (Resend webhook format)
 *  2. Extract tenant ID from recipient address
 *  3. Run spam/marketing filter gate
 *  4. Duplicate check (by Message-ID)
 *  5. Check email limit
 *  6. Call /api/support/generate to create AI draft + ticket
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkEmailLimit } from "@/lib/billing";
import { filterGate } from "@/lib/emailFilter";

export const runtime = "nodejs";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://emailreply.sequenceflow.io").replace(/\/$/, "");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract tenant ID from recipient like "t-{uuid}@inbox.emailreply.sequenceflow.io" */
function extractTenantId(to: string | string[]): string | null {
  const recipients = Array.isArray(to) ? to : [to];
  for (const addr of recipients) {
    // Strip display name and angle brackets → "t-uuid@domain.com"
    const clean = addr.replace(/^.*</, "").replace(/>.*$/, "").trim().toLowerCase();
    const local = clean.split("@")[0];
    if (local.startsWith("t-")) {
      const id = local.slice(2);
      // Basic UUID sanity check (8-4-4-4-12 with hyphens = 36 chars, no hyphens = 32)
      if (id.length >= 32) return id;
    }
  }
  return null;
}

/** Get a header value from either array [{name, value}] or object {key: value} formats */
function getHeader(headers: unknown, name: string): string {
  const lname = name.toLowerCase();
  if (Array.isArray(headers)) {
    return (headers as { name: string; value: string }[])
      .find(h => h.name?.toLowerCase() === lname)?.value ?? "";
  }
  if (headers && typeof headers === "object") {
    const h = headers as Record<string, string>;
    return h[lname] ?? h[name] ?? "";
  }
  return "";
}

/** Extract plain email address from "Name <email@domain.com>" or bare "email@domain.com" */
function extractEmail(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).toLowerCase().trim();
}

/** Extract display name from "Name <email@domain.com>" */
function extractName(raw: string): string {
  const m = raw.match(/^(.+?)\s*</);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    // Resend inbound wraps everything under `data`; some services send it flat
    const email = (body.data ?? body) as Record<string, unknown>;

    // ── Parse fields ────────────────────────────────────────────────────────
    const toRaw      = (email.to ?? email.To ?? "") as string | string[];
    const fromRaw    = String(email.from ?? email.From ?? "");
    const subject    = String(email.subject ?? email.Subject ?? "").trim();
    const text       = String(email.text ?? email.TextBody ?? email.plain ?? "").trim();
    const headers    = email.headers ?? email.Headers ?? [];
    const listId     = getHeader(headers, "List-Id") || getHeader(headers, "list-id");
    const messageId  = (
      getHeader(headers, "Message-ID") ||
      getHeader(headers, "message-id") ||
      String(email.messageId ?? "")
    ).trim();
    const inReplyTo  = getHeader(headers, "In-Reply-To") || getHeader(headers, "in-reply-to");
    const references = getHeader(headers, "References")  || getHeader(headers, "references");

    const fromEmail = extractEmail(fromRaw);
    const fromName  = extractName(fromRaw);

    // ── Gmail forwarding verification auto-confirm ───────────────────────────
    // Google sends a verification email to the forwarding address. We detect it
    // and automatically follow the confirmation link so the user doesn't need to.
    if (fromEmail === "forwarding-noreply@google.com" || fromEmail.endsWith("@google.com") && subject.toLowerCase().includes("forwarding confirmation")) {
      console.log("[inbound] Detected Gmail forwarding verification email — auto-confirming");
      const confirmUrlMatch = text.match(/https:\/\/mail\.google\.com\/mail\/[^\s\r\n]+/);
      if (confirmUrlMatch) {
        try {
          await fetch(confirmUrlMatch[0]);
          console.log("[inbound] Gmail forwarding confirmation link followed successfully");
        } catch (err) {
          console.warn("[inbound] Could not follow Gmail confirmation link:", err);
        }
      }
      return NextResponse.json({ ok: true, skipped: "gmail_verification_handled" });
    }

    // ── Identify tenant ──────────────────────────────────────────────────────
    const tenantId = extractTenantId(toRaw);
    if (!tenantId) {
      console.warn("[inbound] Could not extract tenant from To:", toRaw);
      // Return 200 so the webhook service doesn't retry indefinitely
      return NextResponse.json({ ok: true, skipped: "no_tenant" });
    }

    console.log(`[inbound] Received email for tenant ${tenantId} — subject: "${subject}"`);

    // ── Spam / newsletter filter ─────────────────────────────────────────────
    const { allowed, reason } = filterGate({ subject, from: fromEmail, text, listId });
    if (!allowed) {
      console.log(`[inbound] Tenant ${tenantId} — filtered: ${reason}`);
      return NextResponse.json({ ok: true, skipped: reason });
    }

    const supabase = getSupabaseAdmin();

    // ── Duplicate check (by Message-ID) ─────────────────────────────────────
    if (messageId) {
      const { data: existing } = await supabase
        .from("tickets")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("gmail_message_id", messageId)
        .maybeSingle();

      if (existing) {
        console.log(`[inbound] Duplicate message ${messageId} for tenant ${tenantId}`);
        return NextResponse.json({ ok: true, skipped: "duplicate" });
      }
    }

    // ── Email limit check ────────────────────────────────────────────────────
    const limitCheck = await checkEmailLimit(tenantId);
    if (!limitCheck.allowed) {
      console.log(`[inbound] Tenant ${tenantId} limit reached`);
      return NextResponse.json({ ok: true, skipped: "limit_reached" });
    }

    // ── Build References chain for threading ────────────────────────────────
    // When we reply, we set:
    //   In-Reply-To: {messageId}
    //   References:  {referencesChain}
    const referencesChain = [references, inReplyTo, messageId]
      .filter(Boolean)
      .join(" ")
      .trim();

    // ── Call generate endpoint ───────────────────────────────────────────────
    const generateRes = await fetch(`${SITE_URL}/api/support/generate`, {
      method: "POST",
      headers: {
        "Content-Type":     "application/json",
        "x-internal-secret": process.env.CRON_SECRET ?? "",
      },
      body: JSON.stringify({
        tenant_id:          tenantId,
        from:               fromEmail,
        customer:           { name: fromName || fromEmail },
        subject,
        body:               text,
        original_message_id: messageId || null,
        threadId:           referencesChain || null,
        source:             "inbound_email",
      }),
    });

    if (!generateRes.ok) {
      const errText = await generateRes.text();
      console.error(`[inbound] Generate failed for tenant ${tenantId}:`, errText);
      return NextResponse.json({ ok: false, error: "generate_failed" }, { status: 500 });
    }

    const result = await generateRes.json();
    console.log(`[inbound] Ticket created — tenant ${tenantId}, status: ${result.status}, routing: ${result.routing}`);

    return NextResponse.json({ ok: true, status: result.status });

  } catch (err: any) {
    console.error("[inbound] Unhandled error:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
