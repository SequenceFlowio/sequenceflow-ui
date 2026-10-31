import { NextResponse } from "next/server";
import { requireContentAccess } from "@/lib/contentCalendar/access";
import { genAiConfigured, getGenAiCredits, getGenAiUser, summarizeCredits } from "@/lib/contentCalendar/genaiPro";
import { getKieCredits, kieConfigured } from "@/lib/contentCalendar/kie";
import { metaConfig, publishingEnabled } from "@/lib/contentCalendar/publisher";

export const dynamic = "force-dynamic";

/** Verbinding + resterende credits van GenAI Pro en kie.ai, en of publiceren aanstaat. */
export async function GET() {
  const denied = await requireContentAccess();
  if (denied) return denied;
  const [genai, kie] = await Promise.all([
    (async () => {
      if (!genAiConfigured()) return { configured: false, connected: false, active: false };
      try {
        const [packages, user] = await Promise.all([getGenAiCredits(), getGenAiUser()]);
        return { configured: true, connected: true, username: user.username, balance: user.balance, ...summarizeCredits(packages) };
      } catch (error) {
        return { configured: true, connected: false, active: false, error: error instanceof Error ? error.message : "Status kon niet worden opgehaald" };
      }
    })(),
    (async () => {
      if (!kieConfigured()) return { configured: false, connected: false };
      try {
        return { configured: true, connected: true, credits: await getKieCredits() };
      } catch (error) {
        return { configured: true, connected: false, error: error instanceof Error ? error.message : "Status kon niet worden opgehaald" };
      }
    })(),
  ]);
  const meta = metaConfig();
  return NextResponse.json({ genai, kie, meta: { configured: Boolean(meta), instagram: Boolean(meta?.igUserId), facebook: Boolean(meta?.pageId), autopublish: publishingEnabled() } });
}
