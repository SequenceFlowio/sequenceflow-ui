"use client";

import { ArrowUp, MessageCircle, UserRound, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { CHAT_GREETING, CHAT_LIMITS, QUICK_REPLIES, type ChatContext, type ChatMessage } from "@/lib/marketing/siteChat";

import { SequenceMark, type MarkGear } from "./SequenceMark";

/**
 * SiteChat — de chat rechtsonder op de website. Vaste vragen krijgen direct
 * een antwoord; vrije vragen gaan naar /api/marketing/chat. Wie liever een
 * mens spreekt, laat naam en e-mail achter en het gesprek gaat naar
 * hallo@sequenceflow.io.
 *
 * Het gesprek blijft in sessionStorage staan, zodat het niet verdwijnt als
 * je doorklikt naar een andere pagina van de site.
 */

const GEAR: Record<ChatContext, MarkGear> = { hub: "antenna", support: "headset", content: "camera" };
const STORAGE_KEY = "sf_site_chat";

type View = "chat" | "human" | "sent";

function load(): ChatMessage[] | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(value) ? value.slice(-CHAT_LIMITS.messages) : null;
  } catch {
    return null;
  }
}

function save(messages: ChatMessage[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-CHAT_LIMITS.messages)));
  } catch {
    // Privévenster of geblokkeerde opslag: het gesprek blijft dan alleen op deze pagina.
  }
}

/** Maakt paden (/pricing), links en het mailadres in een antwoord klikbaar. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+|hallo@sequenceflow\.io|(?<![\w.])\/[a-z][a-z0-9\-/#?=&]*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
        const clean = part.replace(/[.,;:!?]+$/, "");
        const tail = part.slice(clean.length);
        const href = clean.includes("@") ? `mailto:${clean}` : clean;
        return <Fragment key={index}><a href={href}>{clean}</a>{tail}</Fragment>;
      })}
    </>
  );
}

export function SiteChat({ context = "hub" }: { context?: ChatContext }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const restored = useRef(false);

  const greeting: ChatMessage = { role: "bot", text: CHAT_GREETING[context] };
  const shown = messages.length ? messages : [greeting];
  const asked = messages.some((message) => message.role === "user");

  useEffect(() => {
    if (!open || restored.current) return;
    restored.current = true;
    const previous = load();
    if (previous?.length) setMessages(previous);
  }, [open]);

  useEffect(() => {
    if (messages.length) save(messages);
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, view]);

  useEffect(() => {
    if (!open) return;
    if (view === "chat") inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      launcherRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, view]);

  const withGreeting = (list: ChatMessage[]) => (list.length ? list : [greeting]);

  function quickReply(question: string, answer: string) {
    setMessages((current) => [...withGreeting(current), { role: "user", text: question }, { role: "bot", text: answer }]);
  }

  async function send() {
    const text = input.trim().slice(0, CHAT_LIMITS.messageChars);
    if (!text || thinking) return;
    const next = [...withGreeting(messages), { role: "user" as const, text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const response = await fetch("/api/marketing/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // De begroeting is vaste tekst, die hoeft niet mee.
        body: JSON.stringify({ messages: next.slice(1) }),
      });
      const data = await response.json().catch(() => ({}));
      setMessages((current) => [...current, { role: "bot", text: data.reply || "Dat lukt me nu even niet. Mail ons gerust via hallo@sequenceflow.io." }]);
    } catch {
      setMessages((current) => [...current, { role: "bot", text: "Er ging iets mis met de verbinding. Probeer het opnieuw, of mail ons via hallo@sequenceflow.io." }]);
    } finally {
      setThinking(false);
    }
  }

  async function requestHuman(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/marketing/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), company: form.get("company"), page: window.location.pathname, messages }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Versturen is niet gelukt.");
      setView("sent");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Versturen is niet gelukt.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`sc${open ? " is-open" : ""}`}>
      <section className="sc-panel" id="site-chat" role="dialog" aria-label="Chat met SequenceFlow" hidden={!open}>
        <header className="sc-head">
          <SequenceMark size={34} state={thinking ? "thinking" : "idle"} gear={GEAR[context]} title="" />
          <div>
            <strong>SequenceFlow-assistent</strong>
            <small><span className="sc-dot" />Antwoordt meestal direct</small>
          </div>
          <button type="button" className="sc-close" onClick={() => { setOpen(false); launcherRef.current?.focus(); }} aria-label="Chat sluiten"><X size={18} /></button>
        </header>

        <div className="sc-body" ref={listRef}>
          {view === "chat" && (
            <>
              <div className="sc-messages" aria-live="polite">
                {shown.map((message, index) => (
                  <div key={index} className={`sc-msg sc-msg--${message.role}`}>
                    {message.role === "bot" ? <Linkified text={message.text} /> : message.text}
                  </div>
                ))}
                {thinking && <div className="sc-msg sc-msg--bot sc-typing" aria-label="De assistent typt"><i /><i /><i /></div>}
              </div>
              {!asked && (
                <div className="sc-quick">
                  {QUICK_REPLIES[context].map((item) => (
                    <button type="button" key={item.question} onClick={() => quickReply(item.question, item.answer)}>{item.question}</button>
                  ))}
                </div>
              )}
            </>
          )}

          {view === "human" && (
            <form className="sc-human" onSubmit={requestHuman}>
              <UserRound size={22} />
              <h3>Spreek een collega</h3>
              <p>Laat je naam en e-mail achter. We sturen het gesprek mee en mailen je binnen één werkdag.</p>
              <label><span>Naam</span><input name="name" required maxLength={120} autoComplete="name" /></label>
              <label><span>E-mail</span><input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
              {/* Honeypot: mensen zien dit veld niet, bots vullen het wel in. */}
              <label className="sc-hp" aria-hidden="true"><span>Bedrijf</span><input name="company" tabIndex={-1} autoComplete="off" /></label>
              {error && <p className="sc-error" role="alert">{error}</p>}
              <div className="sc-human-actions">
                <button type="button" className="sc-link" onClick={() => setView("chat")}>Terug naar de chat</button>
                <button type="submit" className="mk-button mk-button--primary" disabled={sending}>{sending ? "Versturen…" : "Verstuur"}</button>
              </div>
            </form>
          )}

          {view === "sent" && (
            <div className="sc-sent" role="status">
              <SequenceMark size={64} state="happy" gear={GEAR[context]} title="" />
              <h3>Komt goed.</h3>
              <p>Een collega mailt je binnen één werkdag. Je kunt hier gewoon verder chatten.</p>
              <button type="button" className="sc-link" onClick={() => setView("chat")}>Terug naar de chat</button>
            </div>
          )}
        </div>

        {view === "chat" && (
          <footer className="sc-foot">
            <form className="sc-input" onSubmit={(event) => { event.preventDefault(); void send(); }}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={CHAT_LIMITS.messageChars}
                placeholder="Stel je vraag…"
                aria-label="Je vraag"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <button type="submit" aria-label="Versturen" disabled={!input.trim() || thinking}><ArrowUp size={17} /></button>
            </form>
            <button type="button" className="sc-link sc-human-link" onClick={() => setView("human")}>Liever een mens? Laat je gegevens achter</button>
          </footer>
        )}
      </section>

      <button
        ref={launcherRef}
        type="button"
        className="sc-launcher"
        aria-expanded={open}
        aria-controls="site-chat"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={20} /> : <SequenceMark size={34} state="happy" gear={GEAR[context]} title="" />}
        <span>{open ? "Sluiten" : "Vragen?"}</span>
        {!open && <MessageCircle className="sc-launcher-icon" size={15} />}
      </button>
    </div>
  );
}
