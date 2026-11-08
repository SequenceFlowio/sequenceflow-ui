import { NextResponse } from "next/server";
import { listPosts } from "@/lib/contentCalendar/db";
import { pollImages, processQueue } from "@/lib/contentCalendar/generator";
import { publishDuePosts } from "@/lib/contentCalendar/publisher";
import { collectDueMetrics } from "@/lib/contentCalendar/insights";
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
  try { result.metrics = await collectDueMetrics(posts); } catch (error) { result.metricsError = String(error); }
  return NextResponse.json(result);
}
