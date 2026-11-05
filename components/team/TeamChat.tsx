"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, RotateCcw, Square, X } from "lucide-react";

import { LumenAnswer } from "@/app/(app)/lumen/LumenClient";
import { ProposalCard, VeraAnswer } from "@/app/(app)/inventory/VeraChat";
import { SequenceMark, type MarkState } from "@/components/marketing/SequenceMark";
import { useReducedMotion } from "@/components/marketing/useReducedMotion";
import { ASK_TEAM_EVENT, TEAM_MEMBERS, miloBriefing, routeQuestion, splitSuggestedReply, type TeamAgent } from "@/lib/assistants/team";
import type { AssistantProposal } from "@/lib/inventory/assistantCore";
import type { LumenSource } from "@/lib/lumen/types";

import { TEAM_PROFILES } from "./teamProfiles";

/**
 * De team-chat: je praat met Milo. Hoort een vraag bij klantmail, voorraad of
 * content, dan springt Seffy, Otis of Juno uit de teamrij de chat in, doet
 * het werk via zijn eigen route en springt terug zodra Milo iemand anders
 * nodig heeft. Elk teamlid heeft een eigen gespreksgeschiedenis; een gedeelde
 * klantvraag gaat alleen naar Seffy. Niets wordt veranderd zonder klik.
 */

type Turn = { role: "user" | "assistant"; content: string };
type Msg = {
  id: string;
  from: "user" | "system" | TeamAgent;
  content: string;
  /** Wat hij nu doet; weg zodra er tekst binnenkomt. */
  working?: string | null;
  state?: MarkState;
  sources?: LumenSource[];
  proposals?: AssistantProposal[];
  error?: boolean;
  /** Avatar blijft onzichtbaar tot de sprong geland is. */
  landing?: boolean;
};
type Flight = { agent: TeamAgent; from: DOMRect; to: DOMRect; back: boolean } | null;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
// Op een tabblad op de achtergrond komen er geen frames: dan gaat de timer
// voor, zodat het gesprek nooit blijft hangen op een animatie.
const frame = () => new Promise<void>((resolve) => {
  const timer = window.setTimeout(resolve, 60);
  requestAnimationFrame(() => requestAnimationFrame(() => { window.clearTimeout(timer); resolve(); }));
});
const HOP_MS = 720;
let sequence = 0;
// Tijd erbij: na een hot reload begint de teller opnieuw, de berichten niet.
const nextId = () => `t${Date.now().toString(36)}${++sequence}`;
const markProps = (agent: TeamAgent) => ({ gear: TEAM_PROFILES[agent].gear, tint: TEAM_PROFILES[agent].tint });

/** Reeksen van hetzelfde teamlid na elkaar; de groep heet naar het eerste bericht. */
function groupMessages(messages: Msg[]) {
  return messages.map((message, index) => {
    const agentRow = message.from !== "user" && message.from !== "system";
    let start = index;
    while (agentRow && start > 0 && messages[start - 1].from === message.from) start -= 1;
    return {
      message,
      group: messages[start].id,
      first: start === index,
      last: !messages[index + 1] || messages[index + 1].from !== message.from,
    };
  });
}

export default function TeamChat({ language, active, mailId, onClose }: { language: "nl" | "en"; active: boolean; mailId: string | null; onClose: () => void }) {
  const nl = language === "nl";
  const reduced = useReducedMotion();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [guest, setGuest] = useState<TeamAgent | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [calling, setCalling] = useState<TeamAgent | null>(null);
  const [away, setAway] = useState<TeamAgent | null>(null);
  const [departed, setDeparted] = useState<string[]>([]);
  const [flight, setFlight] = useState<Flight>(null);
  const [profile, setProfile] = useState<TeamAgent | null>(null);
  const [sharedMail, setSharedMail] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  // Otis hoort bij Scale: zonder dat pakket staat hij niet in het team.
  const [otisAvailable, setOtisAvailable] = useState(false);

  const histories = useRef<Record<TeamAgent, Turn[]>>({ milo: [], seffy: [], otis: [], juno: [] });
  const seats = useRef<Partial<Record<TeamAgent, HTMLButtonElement | null>>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const landed = useRef<() => void>(() => undefined);
  const positions = useRef<Partial<Record<TeamAgent, { group: string; top: number }>>>({});
  const abort = useRef<AbortController | null>(null);
  const greeted = useRef(false);

  useEffect(() => () => abort.current?.abort(), []);

  // Geopend via een knop als "Vraag Otis": de naam staat al klaar in het veld.
  useEffect(() => {
    const onAsk = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text ?? "";
      setProfile(null);
      setDraft(text);
      requestAnimationFrame(() => input.current?.focus());
    };
    window.addEventListener(ASK_TEAM_EVENT, onAsk);
    return () => window.removeEventListener(ASK_TEAM_EVENT, onAsk);
  }, []);

  // Milo opent met één zin: wat wacht er, wat brandt er. Lukt dat niet, dan
  // stelt hij zich gewoon voor.
  useEffect(() => {
    if (!active || greeted.current) return;
    greeted.current = true;
    const id = nextId();
    setMessages([{ id, from: "milo", content: "", working: TEAM_PROFILES.milo.working[language], state: "observing" }]);
    void (async () => {
      const [context, alerts] = await Promise.all([
        fetch(`/api/lumen/context?language=${language}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).catch(() => null),
        fetch("/api/inventory/alerts/count", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).catch(() => null),
      ]);
      const text = miloBriefing({
        language,
        hour: new Date().getHours(),
        review: context?.support ? context.support.review : null,
        escalated: context?.support ? context.support.escalated : null,
        stockAlerts: typeof alerts?.open === "number" ? alerts.open : null,
      });
      setMessages((current) => current.map((message) => message.id === id ? { ...message, content: text, working: null } : message));
    })();
  }, [active, language]);

  useEffect(() => {
    if (active) requestAnimationFrame(() => input.current?.focus());
  }, [active]);

  // Een gedeelde klantvraag hoort bij de geopende mail; ga je weg, dan vervalt hij.
  const shared = sharedMail && sharedMail === mailId ? sharedMail : null;
  const seffyMail = useRef<string | null>(null);
  // Net een klantvraag gedeeld: de volgende vraag is voor Seffy, ook als er iemand anders bij zit.
  const justShared = useRef(false);

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [messages, reduced]);

  // Elk teamlid staat er maar één keer: verhuist zijn avatar naar een nieuw
  // bericht, dan hupt hij mee. Alleen dan: typen of een antwoord dat regel voor
  // regel binnenkomt laat hem stil staan. We meten de layoutpositie (offsetTop),
  // niet de getekende, zodat een lopend hupje de meting niet verschuift.
  useLayoutEffect(() => {
    const container = scroller.current;
    if (!container) return;
    const next: typeof positions.current = {};
    container.querySelectorAll<HTMLElement>("[data-team-avatar]").forEach((element) => {
      let top = 0;
      for (let node: HTMLElement | null = element; node && node !== container; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
      const agent = element.dataset.teamAvatar as TeamAgent;
      const group = element.dataset.group!;
      const previous = positions.current[agent];
      next[agent] = { group, top };
      const dy = previous && previous.group !== group ? previous.top - top : 0;
      if (!reduced && Math.abs(dy) > 2) {
        element.animate([
          { transform: `translateY(${dy}px)` },
          { transform: `translateY(${dy / 2 - 12}px) scale(1.08,.94)`, offset: 0.55 },
          { transform: "translateY(0) scale(1)" },
        ], { duration: 420, easing: "cubic-bezier(.3,.7,.3,1)" });
      }
    });
    positions.current = next;
  });

  // De sprong tussen de teamrij en de chat.
  useLayoutEffect(() => {
    const element = flyer.current;
    if (!flight || !element) return;
    const { from, to, back } = flight;
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const scale = to.width / from.width;
    const peak = Math.min(0, dy) - 56;
    const animation = element.animate([
      { transform: "translate(0,0) scale(1) rotate(0deg)" },
      { transform: `translate(${dx * 0.1}px,4px) scale(1.06,.9)`, offset: 0.12 },
      { transform: `translate(${dx * 0.5}px,${peak}px) scale(${(1 + scale) / 2 * 1.2}) rotate(${back ? 14 : -14}deg)`, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) scale(${scale * 1.12},${scale * 0.86}) rotate(0deg)`, offset: 0.86 },
      { transform: `translate(${dx}px,${dy}px) scale(${scale})` },
    ], { duration: HOP_MS, easing: "cubic-bezier(.3,.6,.25,1)", fill: "forwards" });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setFlight(null);
      landed.current();
    };
    animation.onfinish = finish;
    const fallback = window.setTimeout(finish, HOP_MS + 250);
    return () => { window.clearTimeout(fallback); animation.cancel(); };
  }, [flight]);

  const fly = useCallback((agent: TeamAgent, from: Element | null | undefined, to: Element | null | undefined, back: boolean) => {
    if (reduced || !from || !to) return Promise.resolve();
    return new Promise<void>((resolve) => {
      landed.current = resolve;
      setFlight({ agent, from: from.getBoundingClientRect(), to: to.getBoundingClientRect(), back });
    });
  }, [reduced]);

  const push = useCallback((message: Omit<Msg, "id">) => {
    const id = nextId();
    setMessages((current) => [...current, { ...message, id }]);
    return id;
  }, []);

  const patch = useCallback((id: string, update: Partial<Msg> | ((message: Msg) => Partial<Msg>)) => {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, ...(typeof update === "function" ? update(message) : update) } : message));
  }, []);

  const sendBack = useCallback(async (agent: TeamAgent) => {
    const avatars = document.querySelectorAll<HTMLElement>(`[data-team-avatar="${agent}"]`);
    const avatar = avatars[avatars.length - 1];
    const group = avatar?.dataset.group;
    if (group) setDeparted((current) => [...current, group]);
    await fly(agent, avatar, seats.current[agent], true);
    setAway(null);
    setGuest(null);
  }, [fly]);

  const bringIn = useCallback(async (agent: TeamAgent) => {
    push({ from: "system", content: nl ? `Milo haalt ${TEAM_PROFILES[agent].name} erbij` : `Milo brings in ${TEAM_PROFILES[agent].name}` });
    const id = push({ from: agent, content: "", working: TEAM_PROFILES[agent].working[language], state: "reading", landing: true });
    setCalling(agent);
    await frame();
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    await frame();
    if (!reduced) await wait(380);
    setAway(agent);
    await fly(agent, seats.current[agent], document.querySelector(`[data-land="${id}"]`), false);
    setCalling(null);
    setGuest(agent);
    patch(id, { landing: false });
    return id;
  }, [fly, language, nl, patch, push, reduced]);

  async function streamLumen(id: string, agent: TeamAgent, signal: AbortSignal) {
    const response = await fetch("/api/lumen/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: histories.current[agent], language, scope: agent === "seffy" ? "mail" : "general", conversationId: agent === "seffy" ? shared : null }),
      signal,
    });
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || (nl ? "Dat lukte even niet." : "That did not work."));
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const item = JSON.parse(line) as { type: string; content?: string; message?: string; sources?: LumenSource[] };
        if (item.type === "meta") patch(id, { sources: item.sources ?? [] });
        if (item.type === "delta" && item.content) {
          text += item.content;
          patch(id, { content: text, working: null });
        }
        if (item.type === "error") throw new Error(item.message || (nl ? "Antwoord afgebroken." : "Answer interrupted."));
      }
      if (done) break;
    }
    return text;
  }

  async function askOtis(id: string, signal: AbortSignal) {
    const response = await fetch("/api/inventory/vera/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, messages: histories.current.otis.slice(-12) }),
      signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || (nl ? "Otis kan nu niet in je voorraad kijken." : "Otis cannot look at your stock right now."));
    patch(id, { content: data.answer, proposals: data.proposals ?? [], working: null });
    return data.answer as string;
  }

  async function ask(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft("");
    setSuggestion(null);
    setProfile(null);
    push({ from: "user", content: text });
    const routed = routeQuestion(text, { mailAttached: Boolean(shared), current: justShared.current ? null : guest });
    // Zonder Scale is er geen Otis: Milo legt het uit in plaats van te doen alsof.
    const otisLocked = routed === "otis" && !otisAvailable;
    const agent: TeamAgent = otisLocked ? "milo" : routed;
    justShared.current = false;
    // Seffy begint opnieuw zodra er een andere (of geen) klantvraag gedeeld is.
    if (agent === "seffy" && seffyMail.current !== shared) {
      histories.current.seffy = [];
      seffyMail.current = shared;
    }
    const controller = new AbortController();
    abort.current = controller;
    let id: string;
    try {
      if (agent !== "milo" && agent !== guest) {
        if (guest) await sendBack(guest);
        id = await bringIn(agent);
      } else {
        if (agent === "milo" && guest) await sendBack(guest);
        id = push({ from: agent, content: "", working: TEAM_PROFILES[agent].working[language], state: agent === "otis" ? "investigating" : "thinking" });
      }
      histories.current[agent] = [...histories.current[agent], { role: "user" as const, content: text }].slice(-12);
      let answer: string;
      if (otisLocked) {
        await wait(500);
        answer = nl
          ? "Voorraad en inkoop zit in het Scale-pakket. Daar telt Otis je voorraad per maat en kleur na en zegt hij wat je moet bijbestellen. Kijk onder Instellingen bij je pakket als je hem erbij wilt."
          : "Stock and buying is part of the Scale plan. There Otis counts your stock per size and colour and tells you what to reorder. Check your plan under Settings if you'd like him on the team.";
        patch(id, { content: answer, working: null });
      } else if (agent === "juno") {
        await wait(700);
        answer = nl
          ? "Oeh, daar zit vast een post in! Maar eerlijk: ik zit nog in early access en kan voor jouw winkel nog geen posts maken. Zodra dat kan, zie je het hier als eerste."
          : "Ooh, there's a post in that! But honestly: I'm still in early access and can't make posts for your shop yet. As soon as I can, you'll see it here first.";
        patch(id, { content: answer, working: null });
      } else if (agent === "otis") {
        answer = await askOtis(id, controller.signal);
      } else {
        answer = await streamLumen(id, agent, controller.signal);
      }
      const { content, suggestion: next } = splitSuggestedReply(answer);
      histories.current[agent] = [...histories.current[agent], { role: "assistant" as const, content }].slice(-12);
      setSuggestion(next);
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : (nl ? "Dat lukte even niet." : "That did not work.");
        setMessages((current) => {
          const last = current[current.length - 1];
          if (last && last.from !== "user" && last.from !== "system" && !last.content) return current.map((item) => item.id === last.id ? { ...item, content: message, working: null, error: true } : item);
          return [...current, { id: nextId(), from: agent, content: message, error: true }];
        });
        histories.current[agent] = histories.current[agent].slice(0, -1);
      }
    } finally {
      abort.current = null;
      setBusy(false);
      requestAnimationFrame(() => input.current?.focus());
    }
  }

  function reset() {
    abort.current?.abort();
    histories.current = { milo: [], seffy: [], otis: [], juno: [] };
    setGuest(null);
    setAway(null);
    setCalling(null);
    setDeparted([]);
    setSuggestion(null);
    setSharedMail(null);
    setBusy(false);
    setMessages([{ id: nextId(), from: "milo", content: nl ? "Schone lei. Waar kan ik mee helpen?" : "Clean slate. What can I help with?" }]);
  }

  useEffect(() => {
    if (!active) return;
    fetch(`/api/inventory/vera/chat?lang=${language}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { setOtisAvailable(Boolean(data)); setCanManage(Boolean(data?.canManage)); })
      .catch(() => setOtisAvailable(false));
  }, [active, language]);

  const rows = groupMessages(messages);
  const latestGroup: Partial<Record<TeamAgent, string>> = {};
  for (const row of rows) if (row.message.from !== "user" && row.message.from !== "system") latestGroup[row.message.from] = row.group;
  const ghost = !draft && suggestion && !busy ? suggestion : null;

  return (
    <div className="team-chat">
      <header className="team-head">
        <button type="button" ref={(element) => { seats.current.milo = element; }}
          className={`team-boss${calling ? " calling" : ""}${profile === "milo" ? " active" : ""}`}
          style={{ "--agent": calling ? TEAM_PROFILES[calling].color : TEAM_PROFILES.milo.color } as React.CSSProperties}
          onClick={() => setProfile(profile === "milo" ? null : "milo")}
          aria-label={nl ? "Milo, je manager. Bekijk profiel" : "Milo, your manager. View profile"} aria-pressed={profile === "milo"}>
          <SequenceMark size={40} {...markProps("milo")} state={calling ? "happy" : busy ? "observing" : "idle"} signal={calling ? TEAM_PROFILES[calling].color : undefined} title="" />
        </button>
        <div className="team-title">
          <strong>{guest ? <>Milo <span>+</span> <b style={{ color: TEAM_PROFILES[guest].color }}>{TEAM_PROFILES[guest].name}</b></> : "Milo"}</strong>
          <small>{guest ? TEAM_PROFILES[guest].role[language] : TEAM_PROFILES.milo.role[language]}</small>
        </div>
        <button type="button" className="team-icon" onClick={reset} aria-label={nl ? "Nieuw gesprek" : "New conversation"} title={nl ? "Nieuw gesprek" : "New conversation"}><RotateCcw size={16} /></button>
        <button type="button" className="team-icon" onClick={onClose} aria-label={nl ? "Chat sluiten" : "Close chat"}><X size={18} /></button>
      </header>

      <nav className="team-seats" aria-label={nl ? "Het team van Milo" : "Milo's team"}>
        <span className="team-seats-label">{nl ? "Zijn team" : "His team"}</span>
        {TEAM_MEMBERS.filter((agent) => agent !== "otis" || otisAvailable).map((agent) => {
          const person = TEAM_PROFILES[agent];
          const empty = away === agent;
          return (
            <button key={agent} type="button" ref={(element) => { seats.current[agent] = element; }}
              className={`team-seat${empty ? " empty" : ""}${profile === agent ? " active" : ""}`}
              style={{ "--agent": person.color } as React.CSSProperties}
              onClick={() => setProfile(profile === agent ? null : agent)}
              aria-label={`${person.name}, ${person.role[language]}${empty ? (nl ? ", in gesprek" : ", in the conversation") : ""}`}
              aria-pressed={profile === agent}>
              <span className="team-seat-mark" aria-hidden>
                <SequenceMark size={30} {...markProps(agent)} state="idle" title="" />
              </span>
              <span className="team-seat-text"><span className="team-seat-name" style={{ color: person.color }}>{person.name}</span><small>{person.role[language]}</small></span>
              {person.early ? <span className="team-early">beta</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="team-log" ref={scroller} role="log" aria-live="polite" aria-label={nl ? "Gesprek" : "Conversation"}>
        {rows.map(({ message, group, first, last }) => {
          if (message.from === "system") return <p key={message.id} className="team-system">{message.content}</p>;
          if (message.from === "user") return <div key={message.id} className="team-msg user"><div className="team-bubble">{message.content}</div></div>;
          const agent = message.from;
          const person = TEAM_PROFILES[agent];
          const showAvatar = last && latestGroup[agent] === group && !departed.includes(group);
          const hidden = messages.some((other) => other.landing && rows.find((row) => row.message.id === other.id)?.group === group);
          return (
            <div key={message.id} className={`team-msg agent${last ? "" : " grouped"}`} style={{ "--agent": person.color } as React.CSSProperties}>
              {showAvatar ? (
                <span className={`team-avatar${hidden ? " hidden" : ""}`} data-group={group} data-land={group} data-team-avatar={agent}>
                  <SequenceMark size={26} {...markProps(agent)} state={message.working ? message.state ?? "thinking" : "idle"} title="" />
                </span>
              ) : <span className="team-avatar" aria-hidden />}
              <div className="team-stack">
                {first && agent !== "milo" ? <span className="team-name">{person.name}<small>{person.role[language]}</small></span> : null}
                {message.working && !message.content ? (
                  <div className="team-working"><span className="team-pulse" />{message.working}</div>
                ) : (
                  <div className={`team-bubble${agent !== "milo" ? " guest" : ""}${message.error ? " error" : ""}`}>
                    {message.error ? message.content : agent === "otis" ? <VeraAnswer content={message.content} /> : <LumenAnswer content={message.content} sources={message.sources ?? []} />}
                  </div>
                )}
                {message.proposals?.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} nl={nl} canManage={canManage} onDone={() => undefined} />)}
              </div>
            </div>
          );
        })}
      </div>

      {profile ? (
        <div className="team-profile" role="dialog" aria-label={TEAM_PROFILES[profile].name} style={{ "--agent": TEAM_PROFILES[profile].color } as React.CSSProperties}>
          <button type="button" className="team-icon team-profile-close" onClick={() => setProfile(null)} aria-label={nl ? "Sluiten" : "Close"}><X size={16} /></button>
          <SequenceMark size={84} {...markProps(profile)} state="happy" followPointer={200} title="" />
          <h3>{TEAM_PROFILES[profile].name}</h3>
          <p className="team-role">{TEAM_PROFILES[profile].role[language]}{TEAM_PROFILES[profile].early ? " · early access" : ""}</p>
          <p className="team-quote">“{TEAM_PROFILES[profile].catchphrase[language]}”</p>
          <p>{TEAM_PROFILES[profile].character[language]}</p>
          <div className="team-lists">
            <div><small>{nl ? "Kan" : "Can"}</small><ul>{TEAM_PROFILES[profile].can.map((item) => <li key={item.en}>{item[language]}</li>)}</ul></div>
            <div><small>{nl ? "Doet nooit" : "Never"}</small><ul>{TEAM_PROFILES[profile].never.map((item) => <li key={item.en}>{item[language]}</li>)}</ul></div>
          </div>
          <button type="button" className="team-ask" onClick={() => { setProfile(null); setDraft(profile === "milo" ? "" : `${TEAM_PROFILES[profile].name}, `); requestAnimationFrame(() => input.current?.focus()); }}>
            {nl ? `Vraag ${TEAM_PROFILES[profile].name} iets` : `Ask ${TEAM_PROFILES[profile].name}`}
          </button>
        </div>
      ) : null}

      <div className="team-compose">
        {mailId ? (
          shared ? (
            <div className="team-context"><Paperclip size={13} /><span>{nl ? "Geopende klantvraag gedeeld met Seffy" : "Open customer question shared with Seffy"}</span><button type="button" onClick={() => { setSharedMail(null); histories.current.seffy = []; }} aria-label={nl ? "Klantvraag niet meer delen" : "Stop sharing the customer question"}><X size={13} /></button></div>
          ) : (
            <button type="button" className="team-context add" onClick={() => { setSharedMail(mailId); justShared.current = true; requestAnimationFrame(() => input.current?.focus()); }}><Paperclip size={13} />{nl ? "Deel deze klantvraag met Seffy" : "Share this customer question with Seffy"}</button>
          )
        ) : null}
        {suggestion && !busy ? (
          <button type="button" className="team-suggestion" onClick={() => void ask(suggestion)}>
            <span>{suggestion}</span><kbd>{nl ? "tik of Tab" : "tap or Tab"}</kbd>
          </button>
        ) : null}
        <form className="team-input" onSubmit={(event) => { event.preventDefault(); void ask(draft); }}>
          <div className="team-field">
            {ghost ? <span className="team-ghost" aria-hidden>{ghost}</span> : null}
            <textarea ref={input} rows={1} value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (ghost && (event.key === "Tab" || (event.key === "ArrowRight" && !draft))) { event.preventDefault(); setDraft(ghost); return; }
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(draft); }
              }}
              placeholder={ghost ? "" : busy ? (nl ? "Het team is bezig…" : "The team is working…") : (nl ? "Vraag Milo iets…" : "Ask Milo something…")}
              aria-label={nl ? "Bericht aan Milo" : "Message to Milo"}
              aria-describedby={ghost ? "team-ghost-hint" : undefined} />
            {ghost ? <span id="team-ghost-hint" className="sr-only">{nl ? `Voorstel: ${ghost}. Druk op Tab om over te nemen.` : `Suggestion: ${ghost}. Press Tab to use it.`}</span> : null}
          </div>
          {busy ? (
            <button type="button" className="team-send" onClick={() => abort.current?.abort()} aria-label={nl ? "Stoppen" : "Stop"}><Square size={14} /></button>
          ) : (
            <button type="submit" className="team-send" disabled={!draft.trim()} aria-label={nl ? "Versturen" : "Send"}><ArrowUp size={17} /></button>
          )}
        </form>
      </div>

      {flight ? (
        <div className="team-flyer" ref={flyer} style={{ left: flight.from.left, top: flight.from.top, width: flight.from.width, height: flight.from.height }} aria-hidden>
          <SequenceMark size={flight.from.width} {...markProps(flight.agent)} state="happy" title="" />
        </div>
      ) : null}

      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
.team-chat{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
.team-head{display:flex;align-items:center;gap:10px;padding:12px 14px 10px}
.team-boss{position:relative;width:48px;height:48px;flex:none;display:grid;place-items:center;border:0;border-radius:14px;background:none;cursor:pointer}
.team-boss:hover,.team-boss.active{background:var(--sf-surface-2)}
.team-boss.calling::before{content:"";position:absolute;inset:2px;border-radius:50%;border:2px solid var(--agent);animation:team-call .9s ease-out infinite}
.team-title{flex:1;min-width:0;display:grid;gap:1px}.team-title strong{font-size:15px;color:var(--sf-text)}.team-title strong span{color:var(--sf-text-muted);font-weight:400}.team-title small{font-size:11px;color:var(--sf-text-muted)}
.team-icon{width:34px;height:34px;flex:none;border:1px solid var(--sf-border);border-radius:10px;background:var(--sf-surface-2);color:var(--sf-text);display:grid;place-items:center;cursor:pointer}
.team-seats{display:flex;align-items:center;gap:4px;margin:0 12px 10px;padding:6px 8px;border:1px solid var(--sf-border);border-radius:14px;background:color-mix(in srgb,var(--sf-surface-2) 55%,transparent);overflow-x:auto;scrollbar-width:none}
.team-seats-label{flex:none;writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--sf-text-muted);padding:0 2px}
.team-seat{position:relative;flex:1;min-width:0;display:flex;align-items:center;gap:7px;padding:5px 6px;border:0;border-radius:10px;background:none;cursor:pointer;color:inherit;font:inherit;text-align:left}
.team-seat-text{min-width:0;display:grid;line-height:1.2}.team-seat-text small{font-size:10px;color:var(--sf-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.team-seat:hover,.team-seat.active{background:var(--sf-surface-2)}
.team-seat-mark{position:relative;width:30px;height:30px;flex:none;display:grid;place-items:center;transition:opacity .2s}
.team-seat.empty .team-seat-mark{opacity:0}
.team-seat.empty::after{content:"";position:absolute;top:50%;left:7px;width:28px;height:28px;margin-top:-14px;border-radius:50%;border:2px dashed color-mix(in srgb,var(--agent) 60%,transparent);animation:team-wait 1.6s ease-in-out infinite}
@keyframes team-wait{50%{transform:scale(.86);opacity:.5}}
@keyframes team-call{from{transform:scale(.85);opacity:1}to{transform:scale(1.35);opacity:0}}
.team-seat-name{font-size:11px;font-weight:600}
.team-early{position:absolute;top:0;right:2px;font-size:8.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:1px 4px;border-radius:5px;background:rgba(196,181,253,.16);color:#C4B5FD}
.team-log{position:relative;flex:1;min-height:0;overflow:auto;border-top:1px solid var(--sf-border);padding:14px 14px 8px;display:flex;flex-direction:column;gap:12px}
.team-system{align-self:center;margin:0;font-size:11px;color:var(--sf-text-muted);padding:3px 10px;border-radius:999px;background:var(--sf-surface-2);animation:team-in .3s ease-out}
.team-msg{display:flex;gap:8px;align-items:flex-end;animation:team-in .32s cubic-bezier(.3,.7,.3,1)}
.team-msg.grouped{margin-bottom:-6px}
@keyframes team-in{from{opacity:0;transform:translateY(6px)}}
.team-msg.user{justify-content:flex-end}
.team-msg.user .team-bubble{max-width:82%;background:var(--sf-text);color:var(--sf-surface);border-radius:18px 18px 5px 18px;white-space:pre-wrap}
.team-avatar{width:26px;height:26px;flex:none;display:grid;place-items:center}
.team-avatar.hidden{visibility:hidden}
.team-stack{min-width:0;max-width:88%;display:grid;gap:6px;justify-items:start}
.team-name{font-size:11.5px;font-weight:600;color:var(--agent);display:flex;gap:6px;align-items:baseline}.team-name small{font-weight:400;color:var(--sf-text-muted)}
.team-bubble{min-width:0;max-width:100%;padding:10px 13px;border-radius:18px 18px 18px 5px;background:var(--sf-surface-2);color:var(--sf-text);font-size:13.5px;line-height:1.55;overflow-wrap:anywhere}
.team-bubble.guest{background:color-mix(in srgb,var(--agent) 9%,var(--sf-surface-2));border:1px solid color-mix(in srgb,var(--agent) 24%,transparent)}
.team-bubble.error{border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.08)}
.team-bubble .lumen-answer-copy p,.team-bubble .vera-answer p{margin:0 0 6px}.team-bubble .lumen-answer-copy p:last-child{margin:0}
.team-bubble .lumen-answer-copy h3,.team-bubble .lumen-answer-copy h4,.team-bubble .vera-answer h4{font-size:13.5px;font-weight:600;margin:8px 0 4px}
.team-bubble .lumen-answer-bullet,.team-bubble .vera-bullet{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px}.team-bubble .lumen-answer-bullet p{margin:0 0 4px}
.team-bubble .lumen-answer-bullet span,.team-bubble .vera-bullet span{color:var(--sf-text-muted)}
.team-bubble .lumen-answer-space{height:4px}
.team-bubble .lumen-cited-sources{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.team-bubble .lumen-cited-sources span,.team-bubble .lumen-inline-source{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--sf-border);border-radius:999px;color:var(--sf-text-muted);font-size:10.5px;padding:2px 8px}
.team-bubble .vera-answer{display:grid;gap:4px}
.team-chat .inv-table-wrap{overflow-x:auto;border:1px solid var(--sf-border);border-radius:10px}
.team-chat .inv-table{width:100%;border-collapse:collapse;font-size:12px}.team-chat .inv-table th,.team-chat .inv-table td{padding:6px 8px;border-bottom:1px solid var(--sf-border);text-align:left}.team-chat .inv-table .num{text-align:right;white-space:nowrap}
.team-chat .vera-card{width:100%;box-sizing:border-box;display:grid;gap:8px;padding:12px;border:1px solid var(--agent);border-radius:12px;background:var(--sf-surface);font-size:12.5px}
.team-chat .vera-card p{margin:0;color:var(--sf-text-muted);line-height:1.5}.team-chat .vera-card h5{margin:4px 0 0;font-size:12px}
.team-chat .vera-card-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.team-chat .settings-btn{min-height:34px;display:inline-flex;align-items:center;gap:6px;padding:0 12px;border:1px solid var(--sf-border);border-radius:9px;background:var(--sf-surface-2);color:var(--sf-text);font-family:inherit;font-weight:600;font-size:12px;cursor:pointer}
.team-chat .settings-btn.primary{border-color:#c7f56f;background:#c7f56f;color:#142000}
.team-chat .settings-hint{color:var(--sf-text-muted);font-size:11px}
.team-working{display:flex;align-items:center;gap:8px;min-height:26px;font-size:12.5px;color:var(--sf-text-muted)}
.team-pulse{width:9px;height:9px;border-radius:50%;background:var(--agent);animation:team-pulse 1.2s ease-out infinite}
@keyframes team-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--agent) 60%,transparent)}100%{box-shadow:0 0 0 9px transparent}}
.team-compose{display:grid;gap:8px;padding:8px 12px 12px;border-top:1px solid var(--sf-border)}
.team-context{display:flex;align-items:center;gap:7px;justify-self:start;max-width:100%;padding:5px 10px;border-radius:999px;border:1px solid color-mix(in srgb,#FFA98A 40%,transparent);background:rgba(255,169,138,.08);color:var(--sf-text);font-family:inherit;font-weight:500;font-size:12px}
.team-context span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.team-context button{display:grid;place-items:center;border:0;background:none;color:var(--sf-text-muted);cursor:pointer;padding:0}
.team-context.add{cursor:pointer;border-style:dashed;background:none;color:var(--sf-text-muted)}
.team-suggestion{justify-self:start;max-width:100%;display:inline-flex;align-items:center;gap:8px;padding:7px 8px 7px 12px;border:1px solid var(--sf-border-strong,var(--sf-border));border-radius:12px;background:var(--sf-surface-2);color:var(--sf-text);font-family:inherit;font-weight:500;font-size:13px;cursor:pointer;animation:team-in .3s ease-out;transition:border-color .2s}
.team-suggestion:hover{border-color:var(--sf-green)}
.team-suggestion span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.team-suggestion kbd{flex:none;font-family:inherit;font-weight:600;font-size:10px;color:var(--sf-text-muted);padding:2px 6px;border:1px solid var(--sf-border);border-radius:6px}
.team-input{display:flex;gap:8px;align-items:flex-end}
.team-field{position:relative;flex:1;min-width:0}
.team-field textarea{width:100%;box-sizing:border-box;min-height:44px;max-height:120px;resize:none;padding:12px 14px;border:1px solid var(--sf-border);border-radius:13px;background:var(--sf-surface-2);color:var(--sf-text);font:inherit;font-size:14px;line-height:1.4;outline:none}
.team-field textarea:focus{border-color:var(--sf-green)}
.team-ghost{position:absolute;left:15px;right:14px;top:12px;font-size:14px;line-height:1.4;color:var(--sf-text-muted);opacity:.7;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.team-send{width:44px;height:44px;flex:none;border:0;border-radius:13px;background:#c7f56f;color:#142000;display:grid;place-items:center;cursor:pointer}
.team-send:disabled{opacity:.35;cursor:not-allowed}
.team-profile{position:absolute;inset:0;z-index:5;background:color-mix(in srgb,var(--sf-surface) 97%,transparent);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:34px 22px 22px;overflow:auto;animation:team-in .25s ease-out}
.team-profile-close{position:absolute;top:12px;right:12px}
.team-profile h3{margin:4px 0 0;font-size:22px;color:var(--agent)}
.team-role{margin:0;font-size:12px;color:var(--sf-text-muted)}
.team-quote{margin:2px 0;font-style:italic;color:var(--sf-text)}
.team-profile>p{margin:0;font-size:13px;line-height:1.55;max-width:340px}
.team-lists{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;text-align:left;margin-top:6px}
.team-lists div{padding:10px;border:1px solid var(--sf-border);border-radius:12px;background:var(--sf-surface-2)}
.team-lists small{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--sf-text-muted)}
.team-lists ul{margin:4px 0 0;padding-left:14px;font-size:12px;line-height:1.45;display:grid;gap:3px}
.team-ask{margin-top:8px;height:40px;padding:0 16px;border:0;border-radius:11px;background:var(--agent);color:#10160E;font-family:inherit;font-weight:650;font-size:13px;cursor:pointer}
.team-flyer{position:fixed;z-index:60;pointer-events:none;transform-origin:top left;filter:drop-shadow(0 8px 16px rgba(0,0,0,.45))}
.team-chat button:focus-visible,.team-chat textarea:focus-visible{outline:2px solid var(--sf-green);outline-offset:2px}
.team-chat .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (prefers-reduced-motion:reduce){.team-chat *,.team-chat *::before,.team-chat *::after{animation:none!important;transition:none!important}}
`;
