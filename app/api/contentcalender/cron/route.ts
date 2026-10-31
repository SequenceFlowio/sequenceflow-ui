import { NextResponse } from "next/server";
import { listPosts } from "@/lib/contentCalendar/db";
import { pollImages, processQueue } from "@/lib/contentCalendar/generator";
import { publishDuePosts } from "@/lib/contentCalendar/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Elke minuut (vercel.json): beelden ophalen, wachtrij verder, ingeplande posts publiceren. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }
  const result: Record<string, unknown> = {};
  try { await pollImages(await listPosts()); } catch (error) { result.pollError = String(error); }
  try { result.queue = (await processQueue())?.status ?? "busy"; } catch (error) { result.queueError = String(error); }
  try { result.publish = await publishDuePosts(); } catch (error) { result.publishError = String(error); }
  return NextResponse.json(result);
}
