/**
 * Zet een reel in de Content Calendar: uploadt video en cover naar de privé-bucket
 * en maakt een goedgekeurde post die de cron op datum en tijd (Nederlandse tijd) publiceert.
 *
 * node --env-file=.env.local scripts/content-add-reel.mjs reel.json
 * reel.json: { id, date, time, video, cover, headline, subline, caption, hashtags[], pillar, status? }
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

const spec = JSON.parse(await readFile(process.argv[2], "utf8"));
const db = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = "content-calendar";

async function upload(path, contentType) {
  const name = `${spec.id}-${basename(path).replace(/[^\w.-]/g, "-")}`;
  const { error } = await db.storage.from(BUCKET).upload(name, await readFile(path), { contentType, upsert: true });
  if (error) throw new Error(`Upload ${name} mislukt: ${error.message}`);
  return name;
}

const video = await upload(spec.video, "video/mp4");
const cover = spec.cover ? await upload(spec.cover, "image/jpeg") : undefined;
const now = new Date().toISOString();
const post = {
  id: spec.id, kind: "reel", video: { file: video, ...(cover ? { cover } : {}) },
  date: spec.date, time: spec.time, pillar: spec.pillar ?? "klantcontact", visual: "ui", template: "photo",
  headline: spec.headline, subline: spec.subline ?? "", slides: [], caption: spec.caption, hashtags: spec.hashtags ?? [], scene: "",
  image: { status: cover ? "ready" : "none", files: cover ? [cover] : [], selected: 0 },
  status: spec.status ?? "approved", createdAt: now, updatedAt: now,
};
const { error } = await db.from("content_posts").upsert({ id: post.id, date: post.date, time: post.time, status: post.status, data: post, updated_at: now });
if (error) throw new Error(`Post opslaan mislukt: ${error.message}`);
console.log(`Ingepland: ${post.id} op ${post.date} ${post.time} (${post.status})`);
