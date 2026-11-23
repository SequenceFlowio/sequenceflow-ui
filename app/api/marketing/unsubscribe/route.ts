import { NextRequest } from "next/server";

import { unsubscribeLead } from "@/lib/marketing/leads";
import { readLeadToken } from "@/lib/marketing/leadsCore";

export const runtime = "nodejs";

const COPY = {
  nl: { done: "Je bent afgemeld", doneText: "Je krijgt geen tips meer van SequenceFlow. Je downloads blijven gewoon werken.", bad: "Deze link werkt niet", badText: "De link is onvolledig. Mail hallo@sequenceflow.io, dan melden we je met de hand af.", fail: "Dat lukte niet", failText: "Probeer het later opnieuw of mail hallo@sequenceflow.io." },
  en: { done: "You're unsubscribed", doneText: "You won't get any more tips from SequenceFlow. Your downloads keep working.", bad: "This link doesn't work", badText: "The link is incomplete. Email hallo@sequenceflow.io and we'll unsubscribe you by hand.", fail: "That didn't work", failText: "Please try again later or email hallo@sequenceflow.io." },
};

function page(lang: "nl" | "en", title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c0b;color:#f1f4ec;font:15px/1.6 system-ui,sans-serif}main{max-width:440px;padding:32px;border:1px solid #23281f;border-radius:16px;background:#111410}h1{margin:0 0 8px;font-size:20px}p{margin:0;color:#bcc2b5}</style></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") === "en" ? "en" : "nl";
  const t = COPY[lang];
  const secret = process.env.LEADS_SECRET || process.env.CRON_SECRET || "";
  const id = secret ? readLeadToken(secret, "unsubscribe", url.searchParams.get("l") ?? "") : null;
  if (!id) return page(lang, t.bad, t.badText, 400);
  try {
    await unsubscribeLead(id);
  } catch (error) {
    console.error("[marketing/unsubscribe]", error instanceof Error ? error.message : error);
    return page(lang, t.fail, t.failText, 500);
  }
  return page(lang, t.done, t.doneText);
}

/** Afmelden voor de tips na een gratis download: de link in de mail (GET) of de afmeldknop van het mailprogramma (POST, RFC 8058). */
export const GET = handle;
export const POST = handle;
