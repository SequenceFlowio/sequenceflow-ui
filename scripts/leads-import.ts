/**
 * Leads toevoegen vanaf de command line (voor de lead-agent): elke webshop wordt
 * opgehaald, gescoord en krijgt een LinkedIn- en mailconcept. Er wordt niets verstuurd.
 *
 * node --env-file=.env.local --experimental-strip-types scripts/leads-import.ts leads.json [--no-draft] [--refresh]
 * leads.json: [{ "url": "winkel.nl", "name"?: "...", "category"?: "...", "bolUrl"?: "...", "source"?: "..." }, ...] of ["winkel.nl", ...]
 */
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { importLead, type LeadInput } from "../lib/sales/store.ts";

const file = process.argv[2];
if (!file) {
  console.error("Gebruik: scripts/leads-import.ts leads.json [--no-draft] [--refresh]");
  process.exit(1);
}
const draft = !process.argv.includes("--no-draft");
const refresh = process.argv.includes("--refresh");
const list = JSON.parse(readFileSync(file, "utf8")) as Array<string | LeadInput>;
const items: LeadInput[] = list.map((item) => (typeof item === "string" ? { url: item } : item)).map((item) => ({ source: "agent", ...item }));

const db = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const counts: Record<string, number> = {};
for (const item of items) {
  const result = await importLead(db, item, { draft, refresh, actor: "lead-agent" });
  counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;
  console.log(`${result.outcome.padEnd(9)} ${String(result.score ?? "").padStart(3)}  ${result.domain}  ${result.detail}`);
}
console.log(Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join(", "));
