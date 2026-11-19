import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { claimReel } from "@/lib/contentCalendar/reels";

/** De worker claimt een reel, zodat twee rondes hem niet tegelijk maken. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  return NextResponse.json({ ok: await claimReel(id) });
}
