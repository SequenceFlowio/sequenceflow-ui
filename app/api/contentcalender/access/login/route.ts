import { NextResponse } from "next/server";
import { SESSION_COOKIE, createAccessSession, sessionSecret } from "@/lib/contentCalendar/access";

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    const expected = process.env.CONTENT_ACCESS_CODE;
    const secret = sessionSecret();
    if (!expected || !secret) return NextResponse.json({ error: "Toegangsbeveiliging is niet geconfigureerd" }, { status: 503 });
    if (typeof code !== "string" || code.length !== expected.length) {
      return NextResponse.json({ error: "Onjuiste toegangscode" }, { status: 401 });
    }
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ code.charCodeAt(i);
    if (mismatch !== 0) return NextResponse.json({ error: "Onjuiste toegangscode" }, { status: 401 });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, await createAccessSession(secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Inloggen is niet gelukt" }, { status: 400 });
  }
}
