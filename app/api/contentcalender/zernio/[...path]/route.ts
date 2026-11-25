import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { zernioConfigured, zernioRead } from "@/lib/contentCalendar/zernio";

/** GET /api/contentcalender/zernio/analytics?... : TikTok-cijfers uit Zernio (alleen lezen). */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  if (!zernioConfigured()) return NextResponse.json({ error: "Zernio is niet ingesteld" }, { status: 400 });
  const { path } = await params;
  try {
    return NextResponse.json(await zernioRead(path.join("/"), new URL(request.url).search));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mislukt" }, { status: 400 });
  }
}
