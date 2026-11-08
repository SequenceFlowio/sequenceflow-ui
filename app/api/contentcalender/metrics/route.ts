import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { refreshRecentMetrics } from "@/lib/contentCalendar/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Knop "Cijfers verversen": de laatste stand van recente posts ophalen bij Meta. */
export async function POST() {
  const denied = await requireContentAccess();
  if (denied) return denied;
  try {
    return NextResponse.json(await refreshRecentMetrics());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cijfers ophalen mislukt" }, { status: 500 });
  }
}
