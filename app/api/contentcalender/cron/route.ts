import { NextResponse } from "next/server";
import { listPosts } from "@/lib/contentCalendar/db";
import { pollImages, processQueue } from "@/lib/contentCalendar/generator";
import { publishDuePosts, retryTikTok, syncTikTokStatuses } from "@/lib/contentCalendar/publisher";
import { collectDueMetrics, importExternalPosts } from "@/lib/contentCalendar/insights";
import { hasValidCronSecret } from "@/lib/auth/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Elke 5 minuten (vercel.json): beelden ophalen, wachtrij verder, ingeplande posts publiceren, cijfers meten. */
export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }
  const result: Record<string, unknown> = {};
  const posts = await listPosts().catch(() => undefined);
  try { await pollImages(posts ?? await listPosts()); } catch (error) { result.pollError = String(error); }
  try { result.queue = (await processQueue())?.status ?? "busy"; } catch (error) { result.queueError = String(error); }
  try { result.publish = await publishDuePosts(); } catch (error) { result.publishError = String(error); }
  try { result.tiktok = await syncTikTokStatuses(posts); } catch (error) { result.tiktokError = String(error); }
  try { result.tiktokRetry = await retryTikTok(posts); } catch (error) { result.tiktokRetryError = String(error); }
  // eens per uur: posts die je zelf op Instagram plaatste in de kalender zetten, zodat ze gemeten worden
  if (new Date().getUTCMinutes() < 5) { try { result.external = await importExternalPosts(posts); } catch (error) { result.externalError = String(error); } }
  try { result.metrics = await collectDueMetrics(posts); } catch (error) { result.metricsError = String(error); }
  return NextResponse.json(result);
}
