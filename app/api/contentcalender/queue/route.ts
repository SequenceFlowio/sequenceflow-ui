import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { stopQueue } from "@/lib/contentCalendar/generator";

export async function DELETE() {
  const denied = await requireContentAccess();
  if (denied) return denied;
  return NextResponse.json({ queue: await stopQueue() });
}
