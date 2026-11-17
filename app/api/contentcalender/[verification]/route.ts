/**
 * Verificatiebestand van TikTok voor het URL-voorvoegsel https://www.sequenceflow.io/api/contentcalender/
 * (TikTok haalt de carrousel-slides alleen op van een geverifieerd adres).
 * Zet in Vercel TIKTOK_VERIFICATION_FILE (bijv. tiktokAbC123.txt) en TIKTOK_VERIFICATION_CONTENT.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ verification: string }> }) {
  const { verification } = await params;
  const file = process.env.TIKTOK_VERIFICATION_FILE;
  const content = process.env.TIKTOK_VERIFICATION_CONTENT;
  if (!file || !content || verification !== file) return new Response("Niet gevonden", { status: 404 });
  return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
