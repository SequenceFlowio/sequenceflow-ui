import { NextResponse } from "next/server";

import { forgetNote, loadOtisProfile, saveOnboarding, skipOnboarding } from "@/lib/inventory/otis";
import { parseOnboarding } from "@/lib/inventory/otisProfile";
import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { loadInventorySettings } from "@/lib/inventory/sync";

export const runtime = "nodejs";

/** GET: is de kennismaking met Otis gedaan, wat weet hij, en de huidige instellingen als startwaarden. */
export async function GET(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  try {
    const [otis, settings] = await Promise.all([loadOtisProfile(access.context.tenantId), loadInventorySettings(access.context.tenantId)]);
    return NextResponse.json({ ...otis, canManage: access.context.role === "admin", settings: { leadTimeDays: settings.leadTimeDays, coverWeeks: settings.coverWeeks, alertEmail: settings.alertEmail ?? true, weeklyEmail: settings.weeklyEmail ?? false } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return inventoryError(error, "onboarding");
  }
}

/** POST: de antwoorden uit de kennismaking opslaan. */
export async function POST(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const answers = parseOnboarding(await req.json().catch(() => ({})));
  if ("error" in answers) return NextResponse.json({ error: answers.error }, { status: 400 });
  try {
    const result = await saveOnboarding(access.context.tenantId, answers);
    if ("error" in result) return NextResponse.json({ error: result.error, notReady: true }, { status: 409 });
    return NextResponse.json({ ok: true, profile: result.profile });
  } catch (error) {
    return inventoryError(error, "onboarding");
  }
}

/** PATCH: { skip: true } om later kennis te maken, of { forgetNote: index } om een notitie te wissen. */
export async function PATCH(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({})) as { skip?: unknown; forgetNote?: unknown };
  try {
    if (body.skip === true) await skipOnboarding(access.context.tenantId);
    else if (Number.isInteger(body.forgetNote)) await forgetNote(access.context.tenantId, body.forgetNote as number);
    else return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await loadOtisProfile(access.context.tenantId)) });
  } catch (error) {
    return inventoryError(error, "onboarding");
  }
}
