"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Check, Package, Plus, Search, Sparkles, X } from "lucide-react";

import { SequenceMark, type MarkGear, type MarkState } from "@/components/marketing/SequenceMark";
import { useReducedMotion } from "@/components/marketing/useReducedMotion";

/**
 * Klikbaar ontwerp van de team-chat. Jij praat met Milo; Milo haalt een
 * specialist erbij, die uit de teamlijst de chat in springt, antwoordt en
 * weer terugspringt. Alles is nepdata en er wordt niets verstuurd.
 */

type AgentId = "milo" | "seffy" | "otis" | "juno";
type Card = "mail" | "stock" | "content" | "week-mail" | "week-stock";
type Msg = {
  id: string;
  from: "user" | AgentId | "system";
  text?: string;
  card?: Card;
  /** Avatar blijft onzichtbaar tot de specialist is geland. */
  landing?: boolean;
  time: string;
};
type Typing = { agent: AgentId; label: string; state: MarkState } | null;
type Flight = { agent: AgentId; from: DOMRect; to: DOMRect; back: boolean } | null;
type Scenario = "mail" | "stock" | "content" | "week";

const AGENTS: Record<AgentId, {
  name: string;
  role: string;
  gear: MarkGear;
  color: string;
  status: string;
  character: string;
  catchphrase: string;
  can: string[];
  never: string[];
  ask: Scenario;
  early?: boolean;
}> = {
  milo: {
    name: "Milo",
    role: "Je manager",
    gear: "antenna",
    color: "#F2F5EA",
    status: "Vraag me alles, ik zet het uit",
    character: "De kalme verbinder. Overziet alles, zegt het in één zin en eindigt altijd met één volgende stap. Kent de eigenaardigheden van zijn team en beschermt jouw tijd. Zijn antenne licht op in de kleur van wie hij erbij roept.",
    catchphrase: "Komt goed. Ik zet het uit.",
    can: ["Je vraag begrijpen en naar de juiste specialist sturen", "Antwoorden van het team in één zin samenvatten", "Elke ochtend zeggen wat er brandt, en wat niet"],
    never: ["Doen alsof hij iets heeft nagekeken", "Iets versturen of bestellen zonder jouw akkoord"],
    ask: "week",
  },
  seffy: {
    name: "Seffy",
    role: "Klantmails",
    gear: "headset",
    color: "#FFA98A",
    status: "3 klantvragen wachten op jou",
    character: "Warm en vlot. Leest elke klantvraag alsof het de eerste van de dag is en schrijft in jouw toon.",
    catchphrase: "Hey baas! Laat mij maar.",
    can: ["Een klantvraag lezen met de bestelling erbij", "Een antwoord in jouw toon voorbereiden", "Zien wat er eerder met deze klant speelde"],
    never: ["Een mail versturen zonder jouw klik", "Korting geven boven jouw grens"],
    ask: "mail",
  },
  otis: {
    name: "Otis",
    role: "Voorraad & inkoop",
    gear: "analyst",
    color: "#91B8D0",
    status: "Hoodie Classic M · over 9 dagen op",
    character: "Precies en een tikje droog. Telt alles twee keer na en rekent in dagen, niet in stuks.",
    catchphrase: "Ik heb het nageteld.",
    can: ["Zien wanneer een variant op raakt", "Inkoop verdelen over maten en kleuren", "Klantvragen meewegen: wie vroeg naar wat"],
    never: ["Een inkooporder plaatsen zonder jouw akkoord", "Gokken zonder verkoopcijfers"],
    ask: "stock",
  },
  juno: {
    name: "Juno",
    role: "Content",
    gear: "camera",
    color: "#C4B5FD",
    status: "Early access · 2 ideeën klaar",
    character: "Nieuwsgierig en beeldend. Ziet in elke klantvraag een idee voor een post.",
    catchphrase: "Oeh, daar zit een post in!",
    can: ["Captions en postideeën voorstellen", "Ideeën halen uit wat klanten vragen"],
    never: ["Zelf iets publiceren", "Doen alsof plannen al werkt (early access)"],
    ask: "content",
    early: true,
  },
};

const TEAM: AgentId[] = ["seffy", "otis", "juno"];

/** Milo houdt het merkgroen; elk teamlid draagt zijn eigen themakleur, ook op rand en accessoire. */
const mark = (id: AgentId) => ({ gear: AGENTS[id].gear, tint: id === "milo" ? undefined : AGENTS[id].color });

type Row = Msg & { typing?: Typing };

const SUGGESTIONS: { scenario: Scenario; text: string }[] = [
  { scenario: "mail", text: "Wat is er met de mail van Sanne?" },
  { scenario: "stock", text: "Moet ik hoodies bijbestellen?" },
  { scenario: "content", text: "Bedenk een post over de nieuwe collectie" },
  { scenario: "week", text: "Hoe ging deze week?" },
];

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const clock = () => new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date());
let sequence = 0;
const nextId = () => `m${++sequence}`;

function match(text: string): Scenario | null {
  const value = text.toLowerCase();
  if (/mail|klant|sanne|pakket|bestelling/.test(value)) return "mail";
  if (/voorraad|bestel|hoodie|inkoop|op raakt/.test(value)) return "stock";
  if (/post|content|caption|insta|tiktok|collectie/.test(value)) return "content";
  if (/week|overzicht|hoe ging|samenvatting/.test(value)) return "week";
  return null;
}

export function TeamChatPrototype() {
  const reduced = useReducedMotion();
  const [messages, setMessages] = useState<Msg[]>([
    // Vaste id en lege tijd: server en browser renderen dit eerste bericht gelijk.
    { id: "intro", from: "milo", text: "Hoi! Ik ben Milo, je manager. Vraag me wat je wilt: ik weet wie in het team het beste kan helpen en haal die erbij.", time: "" },
  ]);
  const [typing, setTyping] = useState<Typing>(null);
  const [away, setAway] = useState<AgentId[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [profile, setProfile] = useState<AgentId | null>(null);
  const [search, setSearch] = useState("");
  const [flight, setFlight] = useState<Flight>(null);
  const [cheer, setCheer] = useState<AgentId | null>(null);
  const [calling, setCalling] = useState<AgentId | null>(null);
  const [departed, setDeparted] = useState<string[]>([]);
  const positions = useRef<Record<string, { top: number; left: number }>>({});

  const seats = useRef<Partial<Record<AgentId, HTMLSpanElement | null>>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const landed = useRef<() => void>(() => undefined);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [messages, typing, reduced]);

  // De sprong: van de stoel in de teamlijst naar de avatar in de chat (of terug).
  useLayoutEffect(() => {
    const element = flyer.current;
    if (!flight || !element) return;
    const { from, to, back } = flight;
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const scale = to.width / from.width;
    const peak = Math.min(from.top, to.top) - from.top - 80;
    const animation = element.animate([
      { transform: "translate(0px, 0px) scale(1) rotate(0deg)" },
      { transform: `translate(${dx * 0.12}px, 6px) scale(1.06, 0.9) rotate(0deg)`, offset: 0.12 },
      { transform: `translate(${dx * 0.5}px, ${peak}px) scale(${1.25 * (back ? 1 : 1)}) rotate(${back ? 14 : -14}deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale * 1.12}, ${scale * 0.86}) rotate(0deg)`, offset: 0.86 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)` },
    ], { duration: 760, easing: "cubic-bezier(.3,.6,.25,1)", fill: "forwards" });
    animation.onfinish = () => { setFlight(null); landed.current(); };
    return () => animation.cancel();
  }, [flight]);

  const fly = useCallback((agent: AgentId, from: Element | null | undefined, to: Element | null | undefined, back: boolean) => {
    if (reduced || !from || !to) return Promise.resolve();
    return new Promise<void>((resolve) => {
      landed.current = resolve;
      setFlight({ agent, from: from.getBoundingClientRect(), to: to.getBoundingClientRect(), back });
    });
  }, [reduced]);

  const push = useCallback((message: Omit<Msg, "id" | "time">) => {
    const full = { ...message, id: nextId(), time: clock() };
    setMessages((current) => [...current, full]);
    return full.id;
  }, []);

  const say = useCallback(async (agent: AgentId, text: string, label: string, state: MarkState = "thinking", card?: Card) => {
    setTyping({ agent, label, state });
    await wait(Math.min(2200, 650 + text.length * 9));
    setTyping(null);
    return push({ from: agent, text, card });
  }, [push]);

  const bringIn = useCallback(async (agent: AgentId) => {
    push({ from: "system", text: `Milo haalt ${AGENTS[agent].name} erbij` });
    const id = push({ from: agent, text: AGENTS[agent].catchphrase, landing: true });
    await frame();
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
    await frame();
    // Milo seint eerst: zijn antenne kleurt naar wie hij roept.
    setCalling(agent);
    if (!reduced) await wait(450);
    setAway((current) => [...current, agent]);
    await fly(agent, seats.current[agent], document.querySelector(`[data-land="${id}"]`), false);
    setCalling(null);
    setMessages((current) => current.map((message) => message.id === id ? { ...message, landing: false } : message));
    setCheer(agent);
    window.setTimeout(() => setCheer((current) => current === agent ? null : current), 900);
  }, [fly, push, reduced]);

  const sendBack = useCallback(async (agent: AgentId) => {
    await wait(500);
    const avatars = document.querySelectorAll<HTMLElement>(`[data-agent-avatar="${agent}"]`);
    const avatar = avatars[avatars.length - 1];
    // Geen kloon: het origineel verdwijnt uit de chat zodra hij terugspringt.
    const group = avatar?.dataset.group;
    if (group) setDeparted((current) => [...current, group]);
    await fly(agent, avatar, seats.current[agent], true);
    setAway((current) => current.filter((id) => id !== agent));
    push({ from: "system", text: `${AGENTS[agent].name} is terug bij het team` });
  }, [fly, push]);

  const run = useCallback(async (scenario: Scenario | null) => {
    setBusy(true);
    try {
      if (scenario === "mail") {
        await say("milo", "Dat is iets voor Seffy.", "Milo leest je vraag…");
        await bringIn("seffy");
        await say("seffy", "Sanne wacht op bestelling #1043. PostNL loopt 3 dagen achter, ze vraagt het nu voor de tweede keer. Ik heb een antwoord klaargezet:", "Seffy leest de mail en de bestelling…", "reading", "mail");
        await say("seffy", "Versturen doe jij, ik heb alleen het concept gemaakt.", "Seffy typt…");
        await sendBack("seffy");
        await say("milo", "Concept staat klaar in je inbox. Nog iets?", "Milo typt…");
      } else if (scenario === "stock") {
        await say("milo", "Even Otis erbij, die kent je voorraad.", "Milo leest je vraag…");
        await bringIn("otis");
        await say("otis", "Ja. Hoodie Classic in M is over 9 dagen op, levertijd is 14 dagen. En 23 klanten vroegen naar M in groen. Mijn advies voor de volgende levering:", "Otis telt Shopify na…", "investigating", "stock");
        await sendBack("otis");
        await say("milo", "Wil je dat Otis een concept-inkooporder klaarzet? Jij keurt hem eerst goed.", "Milo typt…");
      } else if (scenario === "content") {
        await say("milo", "Juno is hier nog in early access, maar ideeën bedenken kan al.", "Milo leest je vraag…");
        await bringIn("juno");
        await say("juno", "Klanten vragen veel naar de pasvorm van de nieuwe hoodie. Drie ideeën:", "Juno bladert door klantvragen…", "reading", "content");
        await say("juno", "Plannen en posten kan ik nog niet, kopiëren wel!", "Juno typt…");
        await sendBack("juno");
        await say("milo", "Zeg het maar als je er een wilt aanpassen.", "Milo typt…");
      } else if (scenario === "week") {
        await say("milo", "Ik vraag het even aan Seffy en Otis.", "Milo leest je vraag…");
        await bringIn("seffy");
        await say("seffy", "Klantmails deze week:", "Seffy telt de week…", "reading", "week-mail");
        await sendBack("seffy");
        await bringIn("otis");
        await say("otis", "Voorraad deze week:", "Otis rekent…", "investigating", "week-stock");
        await sendBack("otis");
        await say("milo", "Kort: support loopt goed, maar bestel deze week nog Hoodie M bij. Dat scheelt je straks lege schappen én \"wanneer is hij er weer\"-mails.", "Milo vat samen…");
      } else {
        await say("milo", "Daar kan ik in dit ontwerp nog niks mee. Probeer een van de vragen hieronder.", "Milo leest je vraag…");
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [bringIn, say, sendBack]);

  function ask(text: string, scenario?: Scenario) {
    const value = text.trim();
    if (!value || busy) return;
    setProfile(null);
    setDraft("");
    push({ from: "user", text: value });
    void run(scenario ?? match(value));
  }

  const rows: Row[] = typing ? [...messages, { id: "typing", from: typing.agent, time: "", typing }] : messages;
  const groupOf = new Map(groupRows(rows).map(({ row, group }) => [row.id, group]));

  // Eén avatar per reeks berichten: komt er een bericht bij, dan hupt hij mee
  // naar beneden in plaats van dat er een tweede exemplaar verschijnt.
  useLayoutEffect(() => {
    const container = scroller.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    const next: Record<string, { top: number; left: number }> = {};
    container.querySelectorAll<HTMLElement>("[data-group]").forEach((element) => {
      const rect = element.getBoundingClientRect();
      const position = { top: rect.top - box.top + container.scrollTop, left: rect.left - box.left };
      const key = element.dataset.group!;
      const previous = positions.current[key];
      next[key] = position;
      const dy = previous ? previous.top - position.top : 0;
      if (!reduced && Math.abs(dy) > 2) {
        element.animate([
          { transform: `translateY(${dy}px)` },
          { transform: `translateY(${dy / 2 - 14}px) scale(1.08, .94)`, offset: 0.55 },
          { transform: "translateY(0) scale(1)" },
        ], { duration: 420, easing: "cubic-bezier(.3,.7,.3,1)" });
      }
    });
    positions.current = next;
  });

  const visibleTeam = TEAM.filter((id) => `${AGENTS[id].name} ${AGENTS[id].role}`.toLowerCase().includes(search.toLowerCase()));
  const lastMilo = [...messages].reverse().find((message) => message.from === "milo")?.text ?? "";
  const activeGuest = away[away.length - 1] ?? null;

  return (
    <main className="tc">
      <p className="tc-note"><Sparkles size={14} /> Klikbaar ontwerp met nepdata. Er wordt niets verstuurd of besteld.</p>
      <div className="tc-app">
        <aside className="tc-side" aria-label="Je team">
          <div className="tc-side-top">
            <label className="tc-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoeken" aria-label="Team doorzoeken" /></label>
            <button type="button" className="tc-icon" aria-label="Nieuw gesprek" onClick={() => { setMessages((current) => current.slice(0, 1)); setDeparted([]); setProfile(null); }} disabled={busy}><Plus size={17} /></button>
          </div>

          <button type="button" className={`tc-row active`} onClick={() => setProfile(null)}>
            <span className={`tc-seat${calling ? " calling" : ""}`} ref={(element) => { seats.current.milo = element; }} style={{ "--agent": calling ? AGENTS[calling].color : "#C7F56F" } as React.CSSProperties}>
              <SequenceMark size={44} gear="antenna" state={calling ? "happy" : busy ? "observing" : "idle"} signal={calling ? AGENTS[calling].color : undefined} title="" />
            </span>
            <span className="tc-row-text">
              <span className="tc-row-head"><strong>Milo</strong><small>{messages[messages.length - 1]?.time}</small></span>
              <span className="tc-row-sub">{typing ? <em>{typing.label}</em> : lastMilo}</span>
            </span>
          </button>

          <p className="tc-label">Het team van Milo</p>
          {visibleTeam.map((id) => {
            const agent = AGENTS[id];
            const isAway = away.includes(id);
            return (
              <button type="button" key={id} className={`tc-row${profile === id ? " active" : ""}`} onClick={() => setProfile(id)} aria-label={`${agent.name}, ${agent.role}. Bekijk profiel`}>
                <span className={`tc-seat${isAway ? " empty" : ""}`} ref={(element) => { seats.current[id] = element; }} style={{ "--agent": agent.color } as React.CSSProperties}>
                  <span className="tc-seat-mark" aria-hidden={isAway}><SequenceMark size={44} {...mark(id)} state="idle" title="" /></span>
                </span>
                <span className="tc-row-text">
                  <span className="tc-row-head"><strong style={{ color: agent.color }}>{agent.name}</strong>{agent.early ? <span className="tc-early">early access</span> : null}</span>
                  <span className="tc-row-sub">{isAway ? <em>In gesprek met Milo…</em> : agent.status}</span>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="tc-chat" aria-label="Gesprek met Milo">
          <header className="tc-head">
            <SequenceMark size={30} gear="antenna" state={typing?.agent === "milo" ? "thinking" : "observing"} signal={calling ? AGENTS[calling].color : undefined} title="" />
            <div><strong>Milo</strong><span>{activeGuest ? <>met <b style={{ color: AGENTS[activeGuest].color }}>{AGENTS[activeGuest].name}</b> erbij</> : "Je manager · online"}</span></div>
          </header>

          <div className="tc-scroll" ref={scroller} aria-live="polite">
            {groupRows(rows).map(({ row, group, first, last }) => row.from === "system" ? (
              <p key={row.id} className="tc-system">{row.text}</p>
            ) : row.from === "user" ? (
              <div key={row.id} className="tc-msg user"><div className="tc-bubble">{row.text}</div></div>
            ) : (
              <AgentMessage key={row.id} row={row} group={group} showName={first} showAvatar={last && !departed.includes(group)}
                hidden={rows.some((other) => other.landing && groupOf.get(other.id) === group)} cheer={cheer === row.from} />
            ))}
          </div>

          <div className="tc-suggest" role="group" aria-label="Voorbeeldvragen">
            {SUGGESTIONS.map((suggestion) => (
              <button type="button" key={suggestion.scenario} onClick={() => ask(suggestion.text, suggestion.scenario)} disabled={busy}>{suggestion.text}</button>
            ))}
          </div>
          <form className="tc-input" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={busy ? "Het team is bezig…" : "Vraag Milo iets…"} aria-label="Bericht aan Milo" disabled={busy} />
            <button type="submit" aria-label="Versturen" disabled={busy || !draft.trim()}><ArrowUp size={17} /></button>
          </form>

          {profile ? <Profile id={profile} onClose={() => setProfile(null)} onAsk={(scenario) => ask(SUGGESTIONS.find((item) => item.scenario === scenario)!.text, scenario)} busy={busy} /> : null}
        </section>
      </div>

      {flight ? (
        <div className="tc-flyer" ref={flyer} style={{ left: flight.from.left, top: flight.from.top, width: flight.from.width, height: flight.from.height }} aria-hidden>
          <SequenceMark size={flight.from.width} {...mark(flight.agent)} state="happy" title="" />
        </div>
      ) : null}

      <style>{STYLES}</style>
    </main>
  );
}

/** Reeksen van hetzelfde teamlid na elkaar; de groep heet naar het eerste bericht. */
function groupRows(rows: Row[]) {
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    const next = rows[index + 1];
    const agentRow = row.from !== "user" && row.from !== "system";
    const first = !previous || previous.from !== row.from;
    let start = index;
    while (agentRow && start > 0 && rows[start - 1].from === row.from) start -= 1;
    return { row, group: rows[start].id, first, last: !next || next.from !== row.from };
  });
}

function AgentMessage({ row, group, showName, showAvatar, hidden, cheer }: { row: Row; group: string; showName: boolean; showAvatar: boolean; hidden: boolean; cheer: boolean }) {
  const id = row.from as AgentId;
  const agent = AGENTS[id];
  const state: MarkState = row.typing ? row.typing.state : cheer ? "happy" : "idle";
  return (
    <div className={`tc-msg agent${showAvatar ? "" : " grouped"}`} style={{ "--agent": agent.color } as React.CSSProperties}>
      {showAvatar ? (
        <span className={`tc-avatar${hidden ? " hidden" : ""}${cheer ? " cheer" : ""}`} data-land={group} data-group={group} data-agent-avatar={id}>
          <SequenceMark size={28} {...mark(id)} state={state} title="" />
        </span>
      ) : <span className="tc-avatar" aria-hidden />}
      <div className="tc-stack">
        {showName && id !== "milo" ? <span className="tc-name">{agent.name}<small>{agent.role}</small></span> : null}
        {row.typing ? (
          <div className="tc-typing"><span className="tc-pulse" />{row.typing.label}</div>
        ) : (
          <>
            <div className={`tc-bubble${id !== "milo" ? " guest" : ""}`}>{row.text}</div>
            {row.card ? <CardView card={row.card} /> : null}
            {row.time ? <time>{row.time}</time> : null}
          </>
        )}
      </div>
    </div>
  );
}

function CardView({ card }: { card: Card }) {
  const [sent, setSent] = useState<"idle" | "confirm" | "done">("idle");
  const [picked, setPicked] = useState<number | null>(null);

  if (card === "mail") return (
    <div className="tc-card">
      <div className="tc-card-head"><strong>Sanne de Vries</strong><span>#1043 · 2e mail</span></div>
      <p className="tc-quote">“Hoi, mijn pakket zou dinsdag komen maar ik heb nog niks. Kunnen jullie even kijken?”</p>
      <div className="tc-facts"><span>PostNL · 3 dagen vertraagd</span><span>Vaste klant · 4 bestellingen</span></div>
      <div className="tc-draft"><small>Concept van Seffy</small>Hoi Sanne, sorry voor het wachten! Je pakket ligt bij PostNL en komt naar verwachting donderdag. Ik houd het voor je in de gaten en laat het weten als er iets verandert.</div>
      {sent === "idle" ? <div className="tc-actions"><button type="button" className="primary" onClick={() => setSent("confirm")}>Versturen…</button><button type="button">Aanpassen</button></div>
        : sent === "confirm" ? <div className="tc-confirm">Naar sanne@voorbeeld.nl versturen? <button type="button" className="primary" onClick={() => setSent("done")}>Ja, versturen</button><button type="button" onClick={() => setSent("idle")}>Nee</button></div>
        : <p className="tc-done"><Check size={14} /> In het echt zou dit nu verstuurd zijn. In dit ontwerp gebeurt er niets.</p>}
    </div>
  );

  if (card === "stock") return (
    <div className="tc-card">
      <div className="tc-card-head"><strong>Hoodie Classic</strong><span>levertijd 14 dagen</span></div>
      {[["M · zwart", 9, 0.25], ["L · zwart", 16, 0.45], ["M · groen", 0, 0], ["S · beige", 31, 0.85]].map(([label, days, fill]) => (
        <div className="tc-stockrow" key={label as string}>
          <span>{label}</span>
          <span className="tc-meter"><span style={{ width: `${(fill as number) * 100}%`, background: (days as number) <= 14 ? "#F5A65B" : "#91B8D0" }} /></span>
          <b>{(days as number) === 0 ? "uitverkocht" : `${days} dagen`}</b>
        </div>
      ))}
      <small className="tc-sub">Verdeling volgende levering (120 stuks)</small>
      <div className="tc-split"><span style={{ flex: 55 }}>zwart 55%</span><span style={{ flex: 30 }}>groen 30%</span><span style={{ flex: 15 }}>beige</span></div>
      <p className="tc-signal"><Package size={14} /> 23 klanten vroegen naar M in groen, dat telt mee.</p>
      <div className="tc-actions"><button type="button" className="primary">Concept-inkooporder</button><button type="button">Waarom zo?</button></div>
    </div>
  );

  if (card === "content") return (
    <div className="tc-card">
      {["“Valt hij klein? Nee. Wij lieten 3 maten zien op 3 lengtes.” 📏", "Achter de schermen: zo testen we de nieuwe hoodie in de wasmachine (30×).", "Jullie vroegen, wij maakten: de hoodie nu ook in groen 💚"].map((idea, index) => (
        <button type="button" key={index} className={`tc-idea${picked === index ? " picked" : ""}`} onClick={() => setPicked(index)}>{picked === index ? <Check size={14} /> : <span>{index + 1}</span>}{idea}</button>
      ))}
      {picked !== null ? <p className="tc-done"><Check size={14} /> Gekopieerd. Plannen komt later.</p> : null}
    </div>
  );

  if (card === "week-mail") return (
    <div className="tc-card tc-stats">
      <div><b>142</b><span>klantvragen</span></div>
      <div><b>88%</b><span>zonder aanpassing</span></div>
      <div><b>4u 20m</b><span>tijd bespaard</span></div>
    </div>
  );

  return (
    <div className="tc-card tc-stats">
      <div><b>2</b><span>bijna op</span></div>
      <div><b>1</b><span>uitverkocht</span></div>
      <div><b>6</b><span>op de wachtlijst</span></div>
    </div>
  );
}

function Profile({ id, onClose, onAsk, busy }: { id: AgentId; onClose: () => void; onAsk: (scenario: Scenario) => void; busy: boolean }) {
  const agent = AGENTS[id];
  return (
    <div className="tc-profile" role="dialog" aria-label={`Profiel van ${agent.name}`} style={{ "--agent": agent.color } as React.CSSProperties}>
      <button type="button" className="tc-icon tc-close" aria-label="Sluiten" onClick={onClose}><X size={17} /></button>
      <div className="tc-profile-mark"><SequenceMark size={104} {...mark(id)} state="happy" followPointer={240} title={agent.name} /></div>
      <h2>{agent.name}</h2>
      <p className="tc-role">{agent.role}{agent.early ? " · early access" : ""}</p>
      <p className="tc-quote">“{agent.catchphrase}”</p>
      <p>{agent.character}</p>
      <div className="tc-lists">
        <div><small>Kan</small><ul>{agent.can.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><small>Doet nooit</small><ul>{agent.never.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      <button type="button" className="tc-ask" disabled={busy} onClick={() => onAsk(agent.ask)}>Vraag Milo om {agent.name} erbij te halen</button>
    </div>
  );
}

const STYLES = `
.tc{min-height:100vh;background:#070807;color:#EDEFE8;padding:20px 16px 32px;font-family:inherit;display:grid;gap:12px;justify-items:center}
.tc-note{margin:0;display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#8E968A}
.tc-app{width:min(1100px,100%);height:min(760px,calc(100vh - 80px));min-height:560px;display:grid;grid-template-columns:300px 1fr;border:1px solid #20241E;border-radius:22px;overflow:hidden;background:#111310;box-shadow:0 30px 80px rgba(0,0,0,.45)}
.tc-side{background:#141713;border-right:1px solid #20241E;padding:14px 10px;display:flex;flex-direction:column;gap:4px;overflow:auto}
.tc-side-top{display:flex;gap:8px;margin-bottom:8px}
.tc-search{flex:1;display:flex;align-items:center;gap:8px;padding:0 12px;height:38px;border-radius:12px;background:#1B1F1A;border:1px solid #262B24;color:#8E968A}
.tc-search input{flex:1;min-width:0;background:none;border:0;color:#EDEFE8;font:inherit;font-size:14px;outline:none}
.tc-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;border:1px solid #262B24;background:#1B1F1A;color:#C9CEC4;cursor:pointer}
.tc-icon:disabled{opacity:.4;cursor:not-allowed}
.tc-label{margin:14px 10px 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6F776B}
.tc-row{display:flex;align-items:center;gap:12px;padding:10px;border-radius:14px;border:0;background:none;color:inherit;text-align:left;cursor:pointer;font:inherit;transition:background .2s}
.tc-row:hover{background:#1A1E19}.tc-row.active{background:#20251F}
.tc-row:focus-visible,.tc button:focus-visible,.tc input:focus-visible{outline:2px solid #C7F56F;outline-offset:2px}
.tc-seat{position:relative;width:44px;height:44px;flex:none;display:grid;place-items:center}
.tc-seat-mark{display:block;transition:opacity .2s}
.tc-seat.empty .tc-seat-mark{opacity:0}
.tc-seat.empty::after{content:"";position:absolute;inset:4px;border-radius:50%;border:2px dashed color-mix(in srgb,var(--agent) 55%,transparent);animation:tc-wait 1.6s ease-in-out infinite}
@keyframes tc-wait{50%{transform:scale(.88);opacity:.5}}
.tc-row-text{min-width:0;flex:1;display:grid;gap:2px}
.tc-row-head{display:flex;align-items:center;gap:8px;justify-content:space-between}
.tc-row-head strong{font-size:15px;font-weight:600}.tc-row-head small{font-size:12px;color:#6F776B}
.tc-row-sub{font-size:13px;color:#8E968A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tc-row-sub em{font-style:normal;color:#C7F56F}
.tc-early{font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(196,181,253,.14);color:#C4B5FD;font-weight:600}
.tc-chat{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0}
.tc-head{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid #20241E}
.tc-head div{display:grid}.tc-head strong{font-size:15px}.tc-head span{font-size:12px;color:#8E968A}
.tc-scroll{flex:1;overflow:auto;padding:22px 20px 10px;display:flex;flex-direction:column;gap:14px}
.tc-system{align-self:center;margin:2px 0;font-size:12px;color:#8E968A;padding:4px 12px;border-radius:999px;background:#181B17;animation:tc-in .35s ease-out}
.tc-msg{display:flex;gap:10px;align-items:flex-end;animation:tc-in .35s cubic-bezier(.3,.7,.3,1)}
@keyframes tc-in{from{opacity:0;transform:translateY(8px)}}
.tc-msg.user{justify-content:flex-end}
.tc-msg.user .tc-bubble{background:#E9ECE3;color:#121410;border-radius:20px 20px 6px 20px;max-width:min(520px,80%)}
.tc-avatar{width:28px;height:28px;flex:none;display:grid;place-items:center;margin-bottom:22px}
.tc-avatar.hidden{visibility:hidden}
.tc-avatar.cheer{animation:tc-cheer .6s cubic-bezier(.3,1.6,.5,1)}
@keyframes tc-cheer{30%{transform:translateY(-6px) rotate(-8deg)}60%{transform:translateY(0) scale(1.08,.92)}}
.tc-stack{display:grid;gap:6px;max-width:min(560px,82%);justify-items:start}
.tc-stack time{font-size:11px;color:#5F675B}
.tc-name{font-size:12px;font-weight:600;color:var(--agent);display:flex;gap:6px;align-items:baseline}.tc-name small{font-weight:400;color:#6F776B}
.tc-bubble{padding:11px 15px;border-radius:20px 20px 20px 6px;background:#1C201B;font-size:14.5px;line-height:1.5}
.tc-bubble.guest{background:color-mix(in srgb,var(--agent) 9%,#1C201B);border:1px solid color-mix(in srgb,var(--agent) 22%,transparent)}
.tc-typing{display:flex;align-items:center;gap:10px;font-size:13px;color:#8E968A;min-height:28px}
.tc-msg.grouped{margin-top:-8px}
.tc-seat.calling::before{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid var(--agent);animation:tc-call .9s ease-out infinite}
@keyframes tc-call{from{transform:scale(.85);opacity:1}to{transform:scale(1.35);opacity:0}}
.tc-pulse{width:10px;height:10px;border-radius:50%;background:var(--agent);box-shadow:0 0 0 0 var(--agent);animation:tc-pulse 1.2s ease-out infinite}
@keyframes tc-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--agent) 60%,transparent)}100%{box-shadow:0 0 0 10px transparent}}
.tc-card{width:min(440px,100%);display:grid;gap:10px;padding:14px;border-radius:16px;background:#161915;border:1px solid #262B24;font-size:13.5px;animation:tc-in .4s ease-out}
.tc-card-head{display:flex;justify-content:space-between;gap:8px}.tc-card-head span{color:#8E968A;font-size:12px}
.tc-quote{margin:0;color:#C9CEC4;font-style:italic;line-height:1.5}
.tc-facts{display:flex;flex-wrap:wrap;gap:6px}.tc-facts span{font-size:11.5px;padding:3px 8px;border-radius:999px;background:#20251F;color:#B5BCB0}
.tc-draft{display:grid;gap:4px;padding:10px 12px;border-radius:12px;background:#1E231D;border-left:3px solid var(--agent);line-height:1.5}
.tc-draft small,.tc-sub{font-size:11px;color:#8E968A}
.tc-actions{display:flex;gap:8px;flex-wrap:wrap}
.tc-actions button,.tc-confirm button{height:34px;padding:0 14px;border-radius:10px;border:1px solid #2C3229;background:#1E231D;color:#EDEFE8;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.tc-actions button.primary,.tc-confirm button.primary{background:#C7F56F;border-color:#C7F56F;color:#10160E}
.tc-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px}
.tc-done{margin:0;display:flex;gap:6px;align-items:center;color:#C7F56F;font-size:12.5px}
.tc-stockrow{display:grid;grid-template-columns:86px 1fr 84px;gap:10px;align-items:center;font-size:12.5px}
.tc-stockrow b{font-weight:600;text-align:right}
.tc-meter{height:7px;border-radius:99px;background:#232822;overflow:hidden}.tc-meter span{display:block;height:100%;border-radius:99px;transform-origin:left;animation:tc-grow .9s cubic-bezier(.3,.7,.3,1)}
@keyframes tc-grow{from{transform:scaleX(0)}}
.tc-split{display:flex;gap:3px;height:26px;border-radius:9px;overflow:hidden;font-size:11px;font-weight:600}
.tc-split span{display:grid;place-items:center;color:#10160E;white-space:nowrap;overflow:hidden;animation:tc-grow .9s cubic-bezier(.3,.7,.3,1);transform-origin:left}
.tc-split span:nth-child(1){background:#91B8D0}.tc-split span:nth-child(2){background:#9FD6A8}.tc-split span:nth-child(3){background:#E6D3B3}
.tc-signal{margin:0;display:flex;gap:6px;align-items:center;color:#91B8D0;font-size:12.5px}
.tc-idea{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid #262B24;background:#1B1F1A;color:inherit;font:inherit;font-size:13.5px;line-height:1.45;cursor:pointer;transition:border-color .2s,transform .2s}
.tc-idea:hover{border-color:#C4B5FD;transform:translateX(2px)}.tc-idea.picked{border-color:#C4B5FD;background:rgba(196,181,253,.08)}
.tc-idea>span,.tc-idea>svg{flex:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:#262B24;font-size:11px;color:#C4B5FD}
.tc-stats{grid-template-columns:repeat(3,1fr);text-align:center}
.tc-stats div{display:grid;gap:2px}.tc-stats b{font-size:22px;font-weight:650;letter-spacing:-.02em;color:var(--agent)}.tc-stats span{font-size:11.5px;color:#8E968A}
.tc-suggest{display:flex;gap:8px;overflow-x:auto;padding:6px 20px 4px;scrollbar-width:none}
.tc-suggest button{flex:none;height:34px;padding:0 14px;border-radius:999px;border:1px solid #262B24;background:#161915;color:#C9CEC4;font:inherit;font-size:13px;cursor:pointer;transition:border-color .2s,color .2s}
.tc-suggest button:hover:not(:disabled){border-color:#C7F56F;color:#EDEFE8}.tc-suggest button:disabled{opacity:.4;cursor:not-allowed}
.tc-input{display:flex;gap:8px;padding:10px 20px 18px}
.tc-input input{flex:1;min-width:0;height:46px;padding:0 16px;border-radius:14px;border:1px solid #262B24;background:#181B17;color:#EDEFE8;font:inherit;font-size:15px;outline:none}
.tc-input button{width:46px;height:46px;border-radius:14px;border:0;background:#C7F56F;color:#10160E;display:grid;place-items:center;cursor:pointer}
.tc-input button:disabled{opacity:.35;cursor:not-allowed}
.tc-profile{position:absolute;inset:0;background:rgba(14,16,13,.97);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:40px 28px;overflow:auto;animation:tc-in .3s ease-out}
.tc-close{position:absolute;top:14px;right:14px}
.tc-profile-mark{filter:drop-shadow(0 12px 30px color-mix(in srgb,var(--agent) 30%,transparent));animation:tc-cheer .7s cubic-bezier(.3,1.6,.5,1)}
.tc-profile h2{margin:4px 0 0;font-size:26px;letter-spacing:-.02em;color:var(--agent)}
.tc-role{margin:0;color:#8E968A;font-size:13px}
.tc-profile>p{max-width:440px;margin:0;line-height:1.55;font-size:14.5px}
.tc-lists{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:min(520px,100%);text-align:left;margin-top:8px}
.tc-lists div{padding:12px 14px;border-radius:14px;background:#171A16;border:1px solid #232822}
.tc-lists small{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6F776B}
.tc-lists ul{margin:6px 0 0;padding-left:16px;display:grid;gap:4px;font-size:13px;line-height:1.45}
.tc-ask{margin-top:10px;height:42px;padding:0 18px;border-radius:12px;border:0;background:var(--agent);color:#10160E;font:inherit;font-weight:650;font-size:14px;cursor:pointer}
.tc-ask:disabled{opacity:.4}
.tc-flyer{position:fixed;z-index:60;pointer-events:none;transform-origin:top left;filter:drop-shadow(0 10px 18px rgba(0,0,0,.5))}
@media (max-width:760px){
  .tc{padding:12px 0 0}.tc-note{padding:0 16px}
  .tc-app{grid-template-columns:1fr;grid-template-rows:auto 1fr;height:calc(100vh - 44px);border-radius:18px 18px 0 0}
  .tc-side{flex-direction:row;align-items:flex-start;gap:4px;padding:10px 12px;border-right:0;border-bottom:1px solid #20241E;overflow-x:auto}
  .tc-side-top,.tc-label{display:none}
  .tc-row{flex-direction:column;gap:4px;padding:6px;width:72px;flex:none}
  .tc-row-text{text-align:center}.tc-row-head{justify-content:center}.tc-row-head small,.tc-row-sub,.tc-early{display:none}
  .tc-row-head strong{font-size:12px}
  .tc-scroll{padding:16px 14px 8px}.tc-suggest{padding:6px 14px 4px}.tc-input{padding:8px 14px 14px}
  .tc-stack{max-width:86%}.tc-lists{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){
  .tc *,.tc *::after{animation:none!important;transition:none!important}
}
`;
