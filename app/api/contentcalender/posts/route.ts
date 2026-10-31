import { NextResponse, after } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { getQueue, listPosts } from "@/lib/contentCalendar/db";
import { imageProviders, pollImages, processQueue, textProvider } from "@/lib/contentCalendar/generator";
import { publishingEnabled } from "@/lib/contentCalendar/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const denied = await requireContentAccess();
  if (denied) return denied;
  await pollImages(await listPosts());
  // volgende posts uit de wachtrij maken zonder deze response op te houden
  after(() => processQueue());
  return NextResponse.json({
    posts: await listPosts(),
    queue: await getQueue(),
    providers: { text: textProvider(), image: imageProviders(), publishing: publishingEnabled() },
  });
}
