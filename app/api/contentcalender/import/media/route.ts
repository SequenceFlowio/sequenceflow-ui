import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { saveMedia } from "@/lib/contentCalendar/db";

/** Eenmalig: één foto per request (Vercel staat max ~4,5 MB per body toe). */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!/^[\w.-]+$/.test(name)) return NextResponse.json({ error: "Ongeldige bestandsnaam" }, { status: 400 });
  await saveMedia(name, await request.arrayBuffer());
  return NextResponse.json({ ok: true, name });
}
