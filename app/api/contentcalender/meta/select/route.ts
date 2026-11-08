import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { selectPage } from "@/lib/contentCalendar/meta";

/** Kies welke Facebook-pagina (en het Instagram-account daaraan) we gebruiken. */
export async function POST(request: Request) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  try {
    const { pageId } = await request.json();
    await selectPage(String(pageId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kiezen mislukt" }, { status: 400 });
  }
}
