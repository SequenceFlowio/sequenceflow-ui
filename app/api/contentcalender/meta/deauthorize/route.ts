import { NextResponse } from "next/server";
import { deleteDataForFacebookUser, parseSignedRequest } from "@/lib/contentCalendar/meta";

/** Deauthorize Callback van Meta: de gebruiker heeft de app verwijderd, dus de koppeling vervalt. */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const { user_id: userId } = parseSignedRequest(String(form.get("signed_request") ?? ""));
    if (userId) await deleteDataForFacebookUser(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ongeldig verzoek" }, { status: 400 });
  }
}
