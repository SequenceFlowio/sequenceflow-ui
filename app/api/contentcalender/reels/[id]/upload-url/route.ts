import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { createUploadUrl } from "@/lib/contentCalendar/db";
import { mediaServerConfigured } from "@/lib/contentCalendar/mediaServer";
import { reelFiles } from "@/lib/contentCalendar/reels";

/**
 * Uploadlinks voor video en cover; de worker zet de bestanden direct in de opslag.
 * Met store "server" houdt de worker de video op de Hetzner-server en uploadt hij alleen de cover.
 * De videolink blijft erbij, zodat een oudere worker gewoon blijft werken.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { id } = await params;
  const files = reelFiles(id);
  try {
    return NextResponse.json({
      video: await createUploadUrl(files.video),
      cover: await createUploadUrl(files.cover),
      files,
      ...(mediaServerConfigured() ? { store: "server" } : {}),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Uploadlink mislukt" }, { status: 500 });
  }
}
