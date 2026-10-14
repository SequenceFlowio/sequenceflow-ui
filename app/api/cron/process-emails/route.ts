import { NextResponse } from "next/server";
import { syncActiveImapMailboxes } from "@/lib/email/inbound/syncImapMailbox";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handler(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ??
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // New mail is read from the INBOX every minute. The spam folders only hold
  // the odd misrouted reply, so they are swept once every ten minutes: on the
  // other runs that would be up to six extra IMAP folder reads per mailbox.
  const spamSweep = new Date().getUTCMinutes() % 10 === 0;
  const results = await syncActiveImapMailboxes({ limitPerMailbox: 20, spamSweep });
  return NextResponse.json({
    ok: true,
    provider: "imap",
    processed: results.reduce((sum, item) => sum + item.processed, 0),
    skipped: results.reduce((sum, item) => sum + item.skipped, 0),
    mailboxes: results,
  });
}

export const GET  = handler;
export const POST = handler;
