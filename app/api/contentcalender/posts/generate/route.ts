import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { listPosts } from "@/lib/contentCalendar/db";
import { buildSlots, enqueue } from "@/lib/contentCalendar/generator";

/** Zet de gekozen periode in de wachtrij; de posts worden daarna één voor één gemaakt. */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  try {
    const body = await request.json();
    const weekdays = Array.isArray(body.weekdays) ? body.weekdays.map(Number).filter((d: number) => d >= 1 && d <= 7) : [];
    const weeks = Math.min(13, Math.max(1, Number(body.weeks) || 1));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startDate ?? "") || !weekdays.length) {
      return NextResponse.json({ error: "Kies een startdatum en minstens één dag" }, { status: 400 });
    }
    const taken = new Set((await listPosts()).map((p) => p.date));
    const slots = buildSlots({ startDate: body.startDate, weeks, weekdays, time: body.time || "12:00" }).filter((s) => !taken.has(s.date));
    if (!slots.length) return NextResponse.json({ error: "Op deze dagen staan al posts gepland" }, { status: 400 });
    const queue = await enqueue(slots);
    return NextResponse.json({ created: slots.length, queue });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Genereren mislukt" }, { status: 500 });
  }
}
