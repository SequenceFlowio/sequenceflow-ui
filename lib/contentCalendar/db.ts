import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Post, Queue } from "./types";

/**
 * Opslag van de Content Calendar in Supabase (migratie 058): posts als jsonb,
 * de wachtrij als één rij en de foto's in de privé-bucket content-calendar.
 * Alleen server-side met de service role.
 */
const BUCKET = "content-calendar";

function db() {
  return getSupabaseAdmin();
}

function toRow(post: Post) {
  return { id: post.id, date: post.date, time: post.time, status: post.status, data: post, updated_at: post.updatedAt };
}

export async function listPosts(): Promise<Post[]> {
  const { data, error } = await db().from("content_posts").select("data").order("date").order("time").limit(2000);
  if (error) throw new Error(`Posts laden mislukt: ${error.message}`);
  return (data ?? []).map((row) => row.data as Post);
}

export async function getPost(id: string): Promise<Post | null> {
  const { data, error } = await db().from("content_posts").select("data").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as Post | undefined) ?? null;
}

export async function insertPosts(posts: Post[]) {
  if (!posts.length) return posts;
  const { error } = await db().from("content_posts").insert(posts.map(toRow));
  if (error) throw new Error(`Posts opslaan mislukt: ${error.message}`);
  return posts;
}

/** Upsert, voor het importeren van lokaal gemaakte posts. */
export async function upsertPost(post: Post) {
  const { error } = await db().from("content_posts").upsert(toRow(post));
  if (error) throw new Error(error.message);
  return post;
}

export async function updatePost(id: string, patch: Partial<Post> | ((post: Post) => Partial<Post>)) {
  const current = await getPost(id);
  if (!current) throw new Error("Post niet gevonden");
  const next: Post = { ...current, ...(typeof patch === "function" ? patch(current) : patch), updatedAt: new Date().toISOString() };
  const { error } = await db().from("content_posts").update(toRow(next)).eq("id", id);
  if (error) throw new Error(`Opslaan mislukt: ${error.message}`);
  return next;
}

export async function deletePost(id: string) {
  const post = await getPost(id);
  const { error } = await db().from("content_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (post?.image.files.length) await db().storage.from(BUCKET).remove(post.image.files);
}

export async function getQueue(): Promise<Queue | null> {
  const { data, error } = await db().from("content_queue").select("data").eq("id", "main").maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as Queue | null) ?? null;
}

export async function updateQueue(fn: (current: Queue | null) => Queue | null) {
  const next = fn(await getQueue());
  const { error } = await db().from("content_queue").upsert({ id: "main", data: next, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return next;
}

/** Korte lease op de wachtrij; false als een andere server er al mee bezig is. */
export async function lockQueue(seconds = 90) {
  const now = new Date();
  const { data, error } = await db()
    .from("content_queue")
    .update({ locked_until: new Date(now.getTime() + seconds * 1000).toISOString() })
    .eq("id", "main")
    .lt("locked_until", now.toISOString())
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function unlockQueue() {
  await db().from("content_queue").update({ locked_until: "epoch" }).eq("id", "main");
}

/** Op Instagram-formaat (1080 breed, JPEG) opslaan: ~300 KB i.p.v. 2,5 MB per foto. */
export async function compressPhoto(data: ArrayBuffer | Buffer) {
  return await sharp(Buffer.from(data as ArrayBuffer)).rotate().resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

export async function saveMedia(filename: string, data: ArrayBuffer) {
  const photo = await compressPhoto(data);
  const { error } = await db().storage.from(BUCKET).upload(filename, photo, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Foto opslaan mislukt: ${error.message}`);
}

export async function readMedia(filename: string) {
  if (!/^[\w.-]+$/.test(filename)) throw new Error("Ongeldige bestandsnaam");
  const { data, error } = await db().storage.from(BUCKET).download(filename);
  if (error || !data) throw new Error("Foto niet gevonden");
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Tijdelijk geldige directe links (7 dagen) naar Supabase Storage, in één call,
 * zodat de browser foto's ophaalt zonder dat er een Vercel-functie tussen zit.
 */
export async function signedMediaUrls(files: string[]) {
  if (!files.length) return {};
  const { data, error } = await db().storage.from(BUCKET).createSignedUrls(files, 60 * 60 * 24 * 7);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl]] : [])));
}

/** Bepaal het echte beeldtype aan de eerste bytes (providers sturen niet altijd het juiste content-type). */
export function sniffImageType(data: Uint8Array): "jpeg" | "png" | "webp" {
  if (data[0] === 0xff && data[1] === 0xd8) return "jpeg";
  if (data[0] === 0x52 && data[1] === 0x49 && data[8] === 0x57 && data[9] === 0x45) return "webp";
  return "png";
}
