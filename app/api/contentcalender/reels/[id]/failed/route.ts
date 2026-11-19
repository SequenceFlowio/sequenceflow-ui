import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { failReel } from "@/lib/contentCalendar/reels";

/** Maken mislukt; na een uur probeert de worker het opnieuw (hooguit drie keer). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  const { error } = await request.json().catch(() => ({}));
  await failReel(id, String(error ?? "onbekende fout"));
  return NextResponse.json({ ok: true });
}
