"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";

import { SequenceMark } from "@/components/marketing/SequenceMark";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

const InventoryChat = dynamic(() => import("@/app/(app)/inventory/VeraChat"), { ssr: false });

type Topic = "general" | "mail" | "content" | "inventory";

const LumenClient = dynamic(() => import("@/app/(app)/lumen/LumenClient"), { ssr: false });

export function SupportChatWidget({ sidebarOpen }: { sidebarOpen: boolean }) {
  const pathname = usePathname();
  const { language } = useTranslation();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [visited, setVisited] = useState<Topic[]>([]);
  const [session, setSession] = useState(0);
  const [mailId, setMailId] = useState<string | null>(null);
  const [includeMail, setIncludeMail] = useState(false);
  const [mailTitle, setMailTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const hidden = sidebarOpen || pathname.startsWith("/sefi") || pathname.startsWith("/lumen");
  const nl = language === "nl";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open && !hidden) panelRef.current?.querySelector<HTMLElement>("[data-chat-focus], textarea, button")?.focus();
  }, [open, hidden, topic]);

  const currentMailId = pathname.match(/^\/inbox\/([a-zA-Z0-9-]+)$/)?.[1] ?? null;
  function choose(next: Topic) {
    setTopic(next);
    setVisited((old) => old.includes(next) ? old : [...old, next]);
  }
  function newChat() {
    setTopic(null); setVisited([]); setSession((value) => value + 1);
    setMailId(null); setIncludeMail(false); setMailTitle("");
  }
  function toggle() { setHasOpened(true); setOpen((current) => !current); }
  const gear = topic === "mail" ? "headset" : topic === "content" ? "camera" : topic === "inventory" ? "analyst" : "none";
  const title = topic === "mail" ? "Seffy" : topic === "inventory" ? "Milo" : topic === "content" ? "Content One" : "SequenceFlow";

  return (
    <div className="support-chat-widget" hidden={hidden}>
      {hasOpened && (
        <section
          ref={panelRef}
          id="support-chat-panel"
          className="support-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label={nl ? "Vraag SequenceFlow" : "Ask SequenceFlow"}
          hidden={!open}
          inert={!open}
        >
          <header className="support-chat-header">
            {topic && <button type="button" onClick={() => setTopic(null)} aria-label={nl ? "Wissel onderwerp" : "Change topic"}><ArrowLeft size={18} /></button>}
            <SequenceMark size={32} gear={gear} state="observing" title="" />
            <div>
              <strong>{title}</strong>
              <span>{nl ? "Jij kiest wie je helpt" : "Choose who helps you"}</span>
            </div>
            <button type="button" onClick={() => { setOpen(false); launcherRef.current?.focus(); }} aria-label={nl ? "Chat sluiten" : "Close chat"}>
              <X size={18} />
            </button>
          </header>
          <div className="chat-body" key={session}>
            {!topic && <div className="chat-topics">
              <h2 data-chat-focus tabIndex={-1}>{nl ? "Waar kan ik je mee helpen?" : "How can I help?"}</h2>
              <p>{nl ? "Kies een onderwerp. Elk gesprek blijft apart." : "Choose a topic. Conversations stay separate."}</p>
              {([
                ["general", "none", nl ? "Algemeen" : "General", nl ? "Je werkruimte, inzichten en voorraad" : "Your workspace, insights and stock"],
                ["mail", "headset", nl ? "Klantmails · Seffy" : "Customer emails · Seffy", nl ? "Begrijp een klantvraag en je antwoord" : "Understand a question and your reply"],
                ["content", "camera", "Content", nl ? "Ideeën en planning · Early access" : "Ideas and planning · Early access"],
              ] as const).map(([value, mark, label, detail]) => <button key={value} type="button" onClick={() => choose(value)}><SequenceMark size={42} gear={mark} state="observing" title="" /><span><strong>{label}</strong><small>{detail}</small></span></button>)}
              {visited.length > 0 && <button type="button" onClick={newChat}>{nl ? "Alle gesprekken wissen en opnieuw beginnen" : "Clear conversations and start again"}</button>}
            </div>}
            {visited.includes("general") && <div className="chat-topic" hidden={topic !== "general"}>
              <button className="chat-stock" type="button" onClick={() => choose("inventory")}><SequenceMark size={28} gear="analyst" state="observing" title="" />{nl ? "Voorraadvraag? Vraag Milo" : "Stock question? Ask Milo"}</button>
              <LumenClient compact active={open && topic === "general"} scope="general" onNewChat={newChat} />
            </div>}
            {visited.includes("mail") && <div className="chat-topic" hidden={topic !== "mail"}>
              {!includeMail && <div className="chat-context">
                <p>{nl ? "Je deelt pas een klantvraag wanneer je die hier toevoegt." : "A customer question is only shared when you add it here."}</p>
                {currentMailId ? <button type="button" onClick={() => { setMailId(currentMailId); setMailTitle(nl ? "Geopende klantvraag" : "Current customer question"); setIncludeMail(true); }}>{nl ? "Geopende klantvraag toevoegen" : "Add current customer question"}</button> : <a href="/inbox">{nl ? "Open een klantvraag in je inbox" : "Open a customer question in your inbox"}</a>}
              </div>}
              {includeMail && <div className="chat-context"><span>{mailTitle}</span><button type="button" onClick={() => { setIncludeMail(false); setMailId(null); }}>{nl ? "Verwijderen en gesprek wissen" : "Remove and clear conversation"}</button></div>}
              <LumenClient key={mailId ?? "no-mail"} compact active={open && topic === "mail"} scope="mail" conversationId={mailId} onNewChat={newChat} />
            </div>}
            {visited.includes("inventory") && <div className="chat-inventory" hidden={topic !== "inventory"}><InventoryChat nl={nl} onChanged={() => {}} /></div>}
            {topic === "content" && <div className="chat-topics"><SequenceMark gear="camera" size={72} state="observing" title="" /><h2>Content One · Early access</h2><p>{nl ? "De content-agent is nog niet beschikbaar in deze werkruimte. Je klantmails worden hier niet gedeeld." : "The content agent is not available in this workspace yet. Your customer emails are not shared here."}</p><a href="https://sequenceflow.io/#content">{nl ? "Bekijk Content One" : "Explore Content One"}</a></div>}
          </div>
        </section>
      )}
      <button
        ref={launcherRef}
        type="button"
        className="support-chat-launcher"
        hidden={open}
        onClick={toggle}
        aria-label={nl ? "Vraag SequenceFlow openen" : "Open Ask SequenceFlow"}
        title={nl ? "Vraag SequenceFlow" : "Ask SequenceFlow"}
        aria-controls={hasOpened ? "support-chat-panel" : undefined}
        aria-expanded={open}
      >
        <SequenceMark size={37} gear="none" state="observing" title="" />
      </button>
      <style jsx>{`
        .chat-body{flex:1;min-height:0;display:flex;flex-direction:column}.chat-topic{display:flex;flex:1;min-height:0;flex-direction:column}.chat-body [hidden]{display:none!important}
        .chat-topics{padding:24px;display:grid;gap:14px;overflow:auto}.chat-topics h2{font-size:21px;margin:0}.chat-topics p,.chat-context p{font-size:13px;color:var(--sf-text-muted);line-height:1.6;margin:0}.chat-topics button{display:flex;align-items:center;gap:14px;text-align:left;border:1px solid var(--sf-border);border-radius:14px;padding:14px;background:var(--sf-surface-2);color:var(--sf-text);cursor:pointer}.chat-topics button:hover{border-color:var(--sf-green)}.chat-topics span{display:grid;gap:5px}.chat-topics small{color:var(--sf-text-muted)}.chat-topics a,.chat-context a{color:var(--sf-green)}
        .chat-context{padding:12px 18px;display:grid;gap:8px;border-bottom:1px solid var(--sf-border);font-size:12px}.chat-context button,.chat-stock{padding:8px 12px;background:var(--sf-surface-2);color:var(--sf-text);border:1px solid var(--sf-border);border-radius:9px;cursor:pointer}.chat-stock{display:flex;align-items:center;gap:8px;margin:12px}.chat-inventory{overflow:auto;padding:16px;flex:1;min-height:0}.chat-body button:focus-visible,.chat-body a:focus-visible{outline:2px solid var(--sf-green);outline-offset:3px}
        .support-chat-widget[hidden],.support-chat-panel[hidden],.support-chat-launcher[hidden]{display:none!important}
        .support-chat-widget{position:fixed;right:24px;bottom:24px;z-index:40;display:flex;flex-direction:column;align-items:flex-end;gap:12px;pointer-events:none}
        .support-chat-widget>*{pointer-events:auto}
        .support-chat-launcher{width:64px;height:64px;display:grid;place-items:center;border:1px solid rgba(199,245,111,.42);border-radius:50%;background:#1a1d16;box-shadow:0 14px 36px rgba(0,0,0,.42),inset 0 0 0 5px rgba(199,245,111,.045);cursor:pointer;transition:background .2s ease,border-color .2s ease,transform .2s ease,box-shadow .2s ease}
        .support-chat-launcher:hover{background:#22281b;border-color:var(--sf-green);box-shadow:0 16px 40px rgba(0,0,0,.48),0 0 0 4px rgba(199,245,111,.1);transform:translateY(-2px)}
        .support-chat-launcher:focus-visible,.support-chat-header button:focus-visible{outline:2px solid var(--sf-green);outline-offset:3px}
        .support-chat-panel{width:min(420px,calc(100vw - 48px));height:min(620px,calc(100dvh - 112px));min-height:320px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--sf-border-strong);border-radius:18px;background:var(--sf-surface);box-shadow:0 24px 70px rgba(0,0,0,.5)}
        .support-chat-header{display:flex;align-items:center;gap:10px;min-height:66px;padding:11px 14px;border-bottom:1px solid var(--sf-border);flex-shrink:0}
        .support-chat-header>div{display:grid;gap:2px;min-width:0;flex:1}
        .support-chat-header strong{font-size:14px;font-weight:700;color:var(--sf-text)}
        .support-chat-header span{font-size:11px;color:var(--sf-text-muted)}
        .support-chat-header button{width:34px;height:34px;border:1px solid var(--sf-border);border-radius:10px;background:var(--sf-surface-2);color:var(--sf-text);display:grid;place-items:center;cursor:pointer}
        @media(max-width:600px){.support-chat-widget{right:12px;bottom:calc(12px + env(safe-area-inset-bottom))}.support-chat-panel{width:calc(100vw - 24px);height:calc(100dvh - 102px - env(safe-area-inset-bottom))}.support-chat-launcher{width:56px;height:56px}}
        @media(prefers-reduced-motion:reduce){.support-chat-launcher{transition:none}.support-chat-launcher:hover{transform:none}}
      `}</style>
    </div>
  );
}
