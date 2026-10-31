import { requireContentAccess } from "@/lib/contentCalendar/access";
import { readMedia, sniffImageType } from "@/lib/contentCalendar/db";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const { file } = await params;
  try {
    const data = await readMedia(file);
    return new Response(new Uint8Array(data), { headers: { "Content-Type": `image/${sniffImageType(data)}`, "Cache-Control": "private, max-age=31536000, immutable" } });
  } catch {
    return new Response("Niet gevonden", { status: 404 });
  }
}
