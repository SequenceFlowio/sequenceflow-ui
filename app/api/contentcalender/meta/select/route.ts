import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { selectPage } from "@/lib/contentCalendar/meta";
import { parseLocale } from "@/lib/contentCalendar/locale";

/** Kies per taal welke Facebook-pagina (en het Instagram-account daaraan) we gebruiken; null = Engels ontkoppelen. */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  try {
    const { pageId, locale } = await request.json();
    await selectPage(pageId === null ? null : String(pageId), parseLocale(locale));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kiezen mislukt" }, { status: 400 });
  }
}
