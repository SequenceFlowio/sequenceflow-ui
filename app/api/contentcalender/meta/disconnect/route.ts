import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { disconnect } from "@/lib/contentCalendar/meta";

/** Ontkoppelen: rechten intrekken bij Meta en alle opgeslagen tokens wissen. */
export async function POST() {
  const denied = await requireContentAccess();
  if (denied) return denied;
  await disconnect();
  return NextResponse.json({ ok: true });
}
