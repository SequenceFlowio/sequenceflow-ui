import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { deleteDataForFacebookUser, parseSignedRequest } from "@/lib/contentCalendar/meta";

/**
 * Data Deletion Request Callback van Meta. Wist de koppeling (tokens, pagina- en accountgegevens)
 * van deze Facebook-gebruiker en geeft een statuslink en bevestigingscode terug.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const { user_id: userId } = parseSignedRequest(String(form.get("signed_request") ?? ""));
    if (userId) await deleteDataForFacebookUser(userId);
    const code = randomBytes(8).toString("hex");
    return NextResponse.json({ url: `${new URL(request.url).origin}/gegevens-verwijderen?code=${code}`, confirmation_code: code });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ongeldig verzoek" }, { status: 400 });
  }
}
