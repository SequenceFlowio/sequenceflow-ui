"use client";

import { useState } from "react";

import TeamChat from "@/components/team/TeamChat";

/**
 * De echte team-chat met nagebootste antwoorden van de server, om het gedrag
 * zonder login te testen: doorschakelen, de sprong, streamen en het
 * voorgestelde antwoord. Er gaat niets naar een echte route.
 */

const MAIL_ID = "11111111-2222-3333-4444-555555555555";

function stream(text: string) {
  const encoder = new TextEncoder();
  const parts = text.match(/[\s\S]{1,14}/g) ?? [];
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "meta", sources: [] })}\n`));
      for (const part of parts) {
        await new Promise((resolve) => setTimeout(resolve, 35));
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "delta", content: part })}\n`));
      }
      controller.close();
    },
  });
}

function installMocks() {
  if (typeof window === "undefined" || (window as { __teamMock?: boolean }).__teamMock) return;
  (window as { __teamMock?: boolean }).__teamMock = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
    if (url.startsWith("/api/lumen/context")) return json({ support: { review: 3, escalated: 1 } });
    if (url.startsWith("/api/inventory/alerts/count")) return json({ open: 2 });
    if (url.startsWith("/api/inventory/vera/chat") && (!init || init.method !== "POST")) return json({ canManage: true, suggestions: [] });
    if (url.startsWith("/api/inventory/vera/chat")) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return json({ answer: "Hoodie Classic in **M zwart** is over 9 dagen op; je levertijd is 14 dagen.\n\n| Variant | Voorraad | Dagen |\n|---|---|---|\n| M zwart | 18 | 9 |\n| L zwart | 41 | 16 |\n\nWil je dat ik een concept-inkooporder klaarzet? Jij keurt hem eerst goed.\n>> Ja, zet hem klaar", proposals: [] });
    }
    if (url.startsWith("/api/lumen/chat")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      await new Promise((resolve) => setTimeout(resolve, 600));
      const text = body.scope === "mail"
        ? body.conversationId
          ? "Sanne vraagt voor de tweede keer naar bestelling #1043. PostNL loopt 3 dagen achter.\n\n- Excuses en een nieuwe verwachte datum\n- Laat weten dat je het volgt\n\nZal ik uitleggen waarom het concept zo is opgebouwd?\n>> Ja, leg uit"
          : "Deel eerst de klantvraag met me via de knop onder het gesprek, dan kijk ik mee."
        : "Deze week kwamen de meeste vragen over **bestelstatus**. Volgende stap: zet de verwachte levertijd duidelijker op je productpagina.\n\nWil je dat ik de top 3 vragen laat zien?\n>> Ja, laat zien";
      return new Response(stream(text), { headers: { "Content-Type": "application/x-ndjson" } });
    }
    return real(input, init);
  };
}

export function LiveHarness() {
  useState(installMocks);
  const [withMail, setWithMail] = useState(true);
  return (
    <main className="dark" style={{ minHeight: "100vh", background: "var(--sf-bg, #0a0a0a)", color: "var(--sf-text)", display: "grid", placeItems: "center", gap: 12, padding: "24px 12px" }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--sf-text-muted)" }}>
        Echte chat, nagebootste server.{" "}
        <label><input type="checkbox" checked={withMail} onChange={(event) => setWithMail(event.target.checked)} /> klantvraag geopend</label>
      </p>
      <section style={{ width: "min(440px, 100%)", height: "min(680px, calc(100vh - 80px))", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--sf-border-strong)", borderRadius: 18, background: "var(--sf-surface)" }}>
        <TeamChat language="nl" active mailId={withMail ? MAIL_ID : null} onClose={() => undefined} />
      </section>
    </main>
  );
}
