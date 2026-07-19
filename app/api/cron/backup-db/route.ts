import { NextResponse } from "next/server";
import { gzipSync } from "node:zlib";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Nightly logical backup of the database into the `db-backups` storage
 * bucket, as gzipped JSON-lines per table plus the auth user list.
 *
 * Why this exists: on the Supabase Free tier there are NO automatic backups.
 * This cron is the safety net that makes downgrading from Pro acceptable —
 * it protects against the realistic failure modes (accidental deletes, a bad
 * migration, a runaway cleanup job). It does NOT protect against total loss
 * of the Supabase project itself, since the dumps live in the same project's
 * storage; mirror to external storage if that ever becomes a concern.
 *
 * Restore path: download the .jsonl.gz for the affected table(s), gunzip,
 * and re-insert via PostgREST or psql (each line is one row as JSON).
 *
 * Layout:  db-backups/YYYY-MM-DD/<table>.jsonl.gz
 * Retention: BACKUP_RETENTION_DAYS daily snapshots, older folders pruned.
 */
const BUCKET = "db-backups";
const BACKUP_RETENTION_DAYS = 14;
const PAGE_SIZE = 1000;

function env(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "CRON_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ??
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");
  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

function serviceHeaders(extra?: Record<string, string>) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

/**
 * Enumerate all tables/views exposed in the public schema by reading the
 * PostgREST OpenAPI root. New tables are picked up automatically — no
 * hardcoded list to keep in sync with migrations.
 */
async function listPublicTables(): Promise<string[]> {
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`OpenAPI introspection failed: HTTP ${res.status}`);
  const spec = (await res.json()) as { definitions?: Record<string, unknown> };
  return Object.keys(spec.definitions ?? {}).sort();
}

async function dumpTable(table: string): Promise<{ rows: number; lines: string[] }> {
  const lines: string[] = [];
  let from = 0;
  // Tables here are small (hundreds of rows); pagination is just a guard.
  // No explicit ordering — acceptable for backup purposes at this size.
  for (;;) {
    const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/${table}?select=*`, {
      headers: serviceHeaders({ Range: `${from}-${from + PAGE_SIZE - 1}`, "Range-Unit": "items" }),
    });
    if (!res.ok) throw new Error(`dump ${table}: HTTP ${res.status}`);
    const rows = (await res.json()) as unknown[];
    for (const row of rows) lines.push(JSON.stringify(row));
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows: lines.length, lines };
}

async function dumpAuthUsers(): Promise<{ rows: number; lines: string[] }> {
  const lines: string[] = [];
  let page = 1;
  for (;;) {
    const res = await fetch(`${env("SUPABASE_URL")}/auth/v1/admin/users?page=${page}&per_page=${PAGE_SIZE}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new Error(`dump auth users: HTTP ${res.status}`);
    const data = (await res.json()) as { users?: unknown[] };
    const users = data.users ?? [];
    for (const user of users) lines.push(JSON.stringify(user));
    if (users.length < PAGE_SIZE) break;
    page += 1;
  }
  return { rows: lines.length, lines };
}

async function ensureBucket() {
  const res = await fetch(`${env("SUPABASE_URL")}/storage/v1/bucket`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  // 400/409 "already exists" is fine — anything else is a real problem.
  if (!res.ok) {
    const body = await res.text();
    if (!body.toLowerCase().includes("already exists")) {
      throw new Error(`ensure bucket: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
  }
}

async function uploadGzip(path: string, lines: string[]) {
  const payload = gzipSync(Buffer.from(lines.join("\n"), "utf8"));
  const res = await fetch(`${env("SUPABASE_URL")}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/gzip", "x-upsert": "true" }),
    body: new Uint8Array(payload),
  });
  if (!res.ok) throw new Error(`upload ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return payload.byteLength;
}

async function listObjects(prefix: string, limit = 1000) {
  const res = await fetch(`${env("SUPABASE_URL")}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix, limit }),
  });
  if (!res.ok) throw new Error(`list ${prefix || "/"}: HTTP ${res.status}`);
  return (await res.json()) as Array<{ name: string }>;
}

/** Delete backup folders older than the retention window. */
async function pruneOldBackups(): Promise<string[]> {
  const cutoff = new Date(Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const root = await listObjects("");
  const staleFolders = root
    .map((entry) => entry.name)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && name < cutoff);

  const pruned: string[] = [];
  for (const folder of staleFolders) {
    const objects = await listObjects(`${folder}/`);
    const paths = objects.map((object) => `${folder}/${object.name}`);
    if (paths.length === 0) continue;
    const res = await fetch(`${env("SUPABASE_URL")}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: serviceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: paths }),
    });
    if (res.ok) pruned.push(folder);
    else console.error(`[backup-db] prune ${folder} failed: HTTP ${res.status}`);
  }
  return pruned;
}

async function handler(req: Request) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    await ensureBucket();

    const tables = await listPublicTables();
    let totalRows = 0;
    let totalBytes = 0;
    const perTable: Record<string, number> = {};

    for (const table of tables) {
      const dump = await dumpTable(table);
      totalBytes += await uploadGzip(`${stamp}/${table}.jsonl.gz`, dump.lines);
      totalRows += dump.rows;
      perTable[table] = dump.rows;
    }

    const authDump = await dumpAuthUsers();
    totalBytes += await uploadGzip(`${stamp}/auth_users.jsonl.gz`, authDump.lines);
    totalRows += authDump.rows;
    perTable.auth_users = authDump.rows;

    const pruned = await pruneOldBackups();

    const summary = {
      ok: true,
      date: stamp,
      tables: tables.length + 1,
      rows: totalRows,
      bytes: totalBytes,
      pruned,
      tookMs: Date.now() - startedAt,
      perTable,
    };
    console.log("[backup-db]", JSON.stringify({ ...summary, perTable: undefined }));
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[backup-db] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
