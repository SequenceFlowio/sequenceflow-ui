/**
 * /api/cron/process-emails
 *
 * Replaces the n8n SupportFlow OS workflow entirely.
 * Called by cron-job.org on a schedule with the header:
 *   x-cron-secret: <CRON_SECRET env var>
 *
 * Replicates the exact logic of SF_v3.json:
 *   Supabase Sign In → GET mail integration → Refresh Token If Expired →
 *   Tenant ID not empty → Get Gmail Messages → Expand Gmail Messages →
 *   Get Gmail Message → Merge Gmail Metadata → Parse Email →
 *   filterGate → If (allowed) → Normalize Input → Mark Email Read →
 *   AI1 (generate) → Normalize Output → Build Email Raw → Create Gmail Draft
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getGmailToken, buildRawEmail, sendGmailMessage } from "@/lib/gmail";

export const runtime    = "nodejs";
export const maxDuration = 60;

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantMeta {
  tenant_id:           string;
  account_email:       string;
  gmail_access_token:  string;
  gmail_refresh_token: string;
  gmail_expires_at:    string;
}

interface ParsedEmail extends TenantMeta {
  id:       string;   // Gmail message id  (= original_message_id)
  threadId: string;   // Gmail thread id
  from:     string;
  to:       string;
  subject:  string;
  snippet:  string;
  text:     string;   // decoded plain-text body
  listId:   string;
}

// ─── Parse Email (n8n Parse Email node) ──────────────────────────────────────

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractPlainText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const found = extractPlainText(part);
      if (found) return found;
    }
  }
  return "";
}

function parseGmailMessage(msg: any, meta: TenantMeta): ParsedEmail {
  const headers = msg.payload?.headers ?? [];
  return {
    ...meta,
    id:       msg.id       ?? "",
    threadId: msg.threadId ?? "",
    from:     getHeader(headers, "From"),
    to:       getHeader(headers, "To"),
    subject:  getHeader(headers, "Subject"),
    listId:   getHeader(headers, "List-Id"),
    snippet:  msg.snippet ?? "",
    text:     extractPlainText(msg.payload) || msg.snippet || "",
  };
}

// ─── filterGate ───────────────────────────────────────────────────────────────

function filterGate(p: ParsedEmail): { allowed: boolean; reason: string } {
  const norm      = (s: string) => s.toLowerCase().trim();
  const extrEmail = (raw: string) => {
    const m = raw.trim().match(/<([^>]+)>/);
    return m ? m[1].toLowerCase() : raw.toLowerCase();
  };
  const includesAny = (hay: string, needles: string[]) =>
    needles.some(n => norm(hay).includes(n));

  const subject   = p.subject.trim();
  const fromEmail = extrEmail(p.from);
  const bodyText  = (p.text || p.snippet).trim();
  const fullText  = `${subject}\n\n${p.snippet}\n\n${p.text}\n\n${p.to}\n\n${p.listId}`.toLowerCase();

  // Newsletter List-Id
  if (p.listId.trim())
    return { allowed: false, reason: "Has List-Id (newsletter)" };

  // Self-email (tenant's own Gmail account emailing itself)
  if (fromEmail === p.account_email.toLowerCase())
    return { allowed: false, reason: "Self-email from account" };

  // Minimum body length — notifications/pings are usually tiny
  if (bodyText.length < 20)
    return { allowed: false, reason: "Body too short (notification)" };

  // Blocked senders
  const BLOCK_FROM = [
    "no-reply","noreply","donotreply","do-not-reply","mailer-daemon",
    "postmaster","bounce","notifications@","notification@","news@","newsletter@",
    "support@webshare.io","followsuggestions@mail.instagram.com",
    "mail.instagram.com","facebookmail.com","accounts.google.com",
  ];
  if (includesAny(fromEmail, BLOCK_FROM))
    return { allowed: false, reason: `Blocked sender: ${fromEmail}` };

  // Blocked domains — social, auth, known bulk-send services
  const BLOCK_DOMAINS = [
    "@mail.instagram.com","@facebookmail.com","@accounts.google.com","@noreply.google.com",
    "@sendgrid.net","@mailchimp.com","@list-manage.com",
    "@e.klaviyo.com","@em.klaviyo.com","@email.klaviyo.com",
    "@e.linkedin.com","@linkedin.com","@notifications.linkedin.com",
    "@constantcontact.com","@mailjet.com","@sendinblue.com","@brevo.com",
    "@mail.warmupinbox.com",
  ];
  if (BLOCK_DOMAINS.some(d => fromEmail.endsWith(d)))
    return { allowed: false, reason: `Blocked domain: ${fromEmail}` };

  // Blocked subjects
  const BLOCK_SUBJECT = [
    // Transactional / financial
    "receipt","invoice","payment","paid","billing","order confirmation",
    "bevestiging","bevestigingsmail","factuur","betaal","betaling",
    // Account / auth
    "abonnee","subscription","trial","security alert","login alert","new login",
    "verification","verify your email","confirm your email",
    "password reset","reset your password","two-factor","2fa","otp",
    // Marketing onboarding
    "welcome to","thanks for signing up","your webshare software receipt",
    // Out-of-office / auto-reply
    "out of office","automatisch antwoord","afwezig","vakantiebericht",
    "auto-reply","auto reply","i am out","ik ben afwezig","absence",
  ];
  if (includesAny(subject, BLOCK_SUBJECT))
    return { allowed: false, reason: `Blocked subject keyword` };

  // Marketing markers in body/full text
  const BLOCK_MARKETING = [
    "unsubscribe","afmelden","view in browser","bekijk in browser",
    "marketing","promotion","promotie","advertisement",
    "response rate","open rate","deliverability","email warmup","warm up",
    "warmup","upgrade now","upgrade to our","pro plan","case study",
    "click here to","add your inbox","get started on your",
  ];
  if (includesAny(fullText, BLOCK_MARKETING))
    return { allowed: false, reason: "Marketing/newsletter markers" };

  // Regex checks
  const BLOCK_REGEX = [
    /unsubscribe/i, /afmelden/i, /do-?not-?reply/i, /no-?reply/i,
    /mailer-daemon/i, /password\s*reset/i, /verify\s*your\s*email/i,
    /\bsecurity\s*alert\b/i, /\blogin\s*alert\b/i,
    /\bauto-?repl(y|ied)\b/i, /\bout\s+of\s+office\b/i,
  ];
  if (BLOCK_REGEX.some(r => r.test(fullText)))
    return { allowed: false, reason: "Automated email regex match" };

  // Must look like support or human-written
  const SUPPORT_KW = [
    // Dutch
    "bestelling","ordernummer","pakket","levering","bezorg","track",
    "trace","retour","terug","kapot","beschadigd","defect","ontbreekt",
    "missen","garantie","klacht","probleem","vraag","help",
    // English
    "order","refund","return","damaged","missing","complaint","warranty",
    "delivery","shipment","tracking","issue","problem","question",
  ];
  const HUMAN_MARKERS = [
    // Dutch
    "groetjes","met vriendelijke groet","alvast bedankt","hoi","hallo",
    "beste","kunt u","kunnen jullie",
    // English
    "kind regards","regards","sincerely","thank you","thanks",
    "dear","hi,","hello,",
  ];

  const supportHit = SUPPORT_KW.some(k => fullText.includes(k));
  // "?" must be in the subject to count — a "?" buried in a marketing body is not enough
  const humanHit   = HUMAN_MARKERS.some(m => fullText.includes(m)) || subject.includes("?");

  if (!supportHit && !humanHit)
    return { allowed: false, reason: "No support keywords and not human-written" };

  return { allowed: true, reason: "OK" };
}

// ─── GET / POST handler ───────────────────────────────────────────────────────

async function handler(req: Request) {
  // 1. Verify cron secret
  const secret =
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase  = getSupabaseAdmin();
  const siteUrl   = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://supportflow.sequenceflow.io").replace(/\/$/, "");

  // 2. Fetch active Gmail integrations
  const { data: integrations, error: intErr } = await supabase
    .from("tenant_integrations")
    .select("tenant_id, account_email, access_token, refresh_token, expires_at")
    .eq("provider", "gmail")
    .in("status", ["connected", "active"]);

  if (intErr) {
    console.error("[cron] Failed to fetch integrations:", intErr.message);
    return NextResponse.json({ error: intErr.message }, { status: 500 });
  }

  if (!integrations?.length) {
    return NextResponse.json({ ok: true, message: "No active Gmail integrations", results: [] });
  }

  // 4. Process each tenant
  type TenantResult = { tenant_id: string; processed: number; skipped: number; errors: string[] };
  const results: TenantResult[] = [];

  for (const integration of integrations) {
    // Tenant ID not empty right? (If node)
    if (!integration.tenant_id?.trim()) continue;

    const r: TenantResult = { tenant_id: integration.tenant_id, processed: 0, skipped: 0, errors: [] };

    try {
      // Refresh Token If Expired
      let accessToken = integration.access_token;
      const isExpired = Date.now() >= new Date(integration.expires_at).getTime() - 60_000;
      if (isExpired) {
        try {
          accessToken = await getGmailToken(integration.tenant_id);
        } catch (e: any) {
          r.errors.push(`Token refresh: ${e.message}`);
          results.push(r);
          continue;
        }
      }

      const meta: TenantMeta = {
        tenant_id:           integration.tenant_id,
        account_email:       integration.account_email,
        gmail_access_token:  accessToken,
        gmail_refresh_token: integration.refresh_token,
        gmail_expires_at:    integration.expires_at,
      };

      // Get Gmail Messages (is:unread, max 5)
      const msgsRes = await fetch(
        `${GMAIL}/messages?q=is%3Aunread&maxResults=5`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgsRes.ok) {
        r.errors.push(`Gmail messages fetch failed (${msgsRes.status})`);
        results.push(r);
        continue;
      }

      const msgsData  = await msgsRes.json();
      const msgRefs: { id: string; threadId: string }[] = msgsData.messages ?? [];

      if (!msgRefs.length) {
        results.push(r);
        continue;
      }

      // Process each message (Expand Gmail Messages → Get Gmail Message → Merge → Parse → filter → generate → draft)
      for (const ref of msgRefs) {
        try {
          // Get Gmail Message (full format)
          const fullRes = await fetch(
            `${GMAIL}/messages/${ref.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!fullRes.ok) { r.skipped++; continue; }
          const fullMsg = await fullRes.json();

          // Parse Email + Merge Gmail Metadata
          const parsed = parseGmailMessage(fullMsg, meta);

          // filterGate
          const { allowed, reason } = filterGate(parsed);
          if (!allowed) {
            console.log(`[cron] [${integration.tenant_id}] Skip ${ref.id}: ${reason}`);
            r.skipped++;
            continue;
          }

          // Duplicate check — skip if already processed (guards against mark-read failures)
          const { data: existing } = await supabase
            .from("tickets")
            .select("id")
            .eq("gmail_message_id", ref.id)
            .eq("tenant_id", integration.tenant_id)
            .maybeSingle();
          if (existing) {
            console.log(`[cron] [${integration.tenant_id}] Duplicate skip ${ref.id}`);
            r.skipped++;
            continue;
          }

          // Normalize Input
          const normalized = {
            tenant_id:           parsed.tenant_id,
            from:                parsed.from,
            subject:             parsed.subject,
            text:                parsed.text || parsed.snippet,
            snippet:             parsed.snippet,
            threadId:            parsed.threadId || parsed.id,
            original_message_id: parsed.id || parsed.threadId,
            gmail_access_token:  parsed.gmail_access_token,
          };

          // Mark Email Read (parallel — don't await result to keep things fast)
          fetch(`${GMAIL}/messages/${ref.id}/modify`, {
            method: "POST",
            headers: {
              Authorization:  `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
          }).catch(e => console.warn(`[cron] Mark read failed: ${e.message}`));

          // AI1 — call /api/support/generate
          const genRes = await fetch(`${siteUrl}/api/support/generate`, {
            method: "POST",
            headers: {
              "x-internal-secret": process.env.CRON_SECRET!,
              "Content-Type":      "application/json",
            },
            body: JSON.stringify({
              text:                normalized.text,
              subject:             normalized.subject,
              from:                normalized.from,
              tenant_id:           normalized.tenant_id,
              threadId:            normalized.threadId,
              original_message_id: normalized.original_message_id,
            }),
          });

          if (!genRes.ok) {
            const err = await genRes.json().catch(() => ({}));
            r.errors.push(`Generate ${ref.id}: ${err.error ?? genRes.status}`);
            continue;
          }

          const generated = await genRes.json();

          // Normalize Output — merge AI response with original input
          const draftBody    = generated.draft?.body    ?? "";
          const draftSubject = generated.draft?.subject ?? `Re: ${normalized.subject}`;
          const replyTo      = generated.draft?.from    ?? normalized.from;

          // Build Email Raw + HTTP Request (create Gmail draft)
          if (draftBody) {
            const { raw } = buildRawEmail({
              to:        replyTo,
              subject:   draftSubject,
              body:      draftBody,
              inReplyTo: normalized.original_message_id || undefined,
              references: normalized.original_message_id || undefined,
              threadId:  normalized.threadId || undefined,
            });

            const draftRes = await fetch(`${GMAIL}/drafts`, {
              method: "POST",
              headers: {
                Authorization:  `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: { raw, threadId: normalized.threadId || undefined },
              }),
            });

            if (!draftRes.ok) {
              const txt = await draftRes.text();
              r.errors.push(`Draft create ${ref.id}: ${txt}`);
              continue;
            }
          }

          r.processed++;
        } catch (e: any) {
          r.errors.push(`Message ${ref.id}: ${e.message}`);
        }
      }
    } catch (e: any) {
      r.errors.push(`Tenant error: ${e.message}`);
    }

    results.push(r);
  }

  const total = results.reduce((s, x) => s + x.processed, 0);
  console.log(`[cron] Done — ${total} emails processed across ${results.length} tenants`);

  return NextResponse.json({ ok: true, results });
}

export const GET  = handler;
export const POST = handler;
