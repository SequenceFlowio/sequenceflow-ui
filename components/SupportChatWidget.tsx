"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { SequenceMark } from "@/components/marketing/SequenceMark";
import { ASK_TEAM_EVENT } from "@/lib/assistants/team";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

// Pas laden bij de eerste keer openen: de chat hoort niet in elke eerste paginalading.
const TeamChat = dynamic(() => import("@/components/team/TeamChat"), { ssr: false });

/** De zwevende chat rechtsonder: Milo en zijn team. */
export function SupportChatWidget({ sidebarOpen }: { sidebarOpen: boolean }) {
  const pathname = usePathname();
  const { language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const hidden = sidebarOpen || pathname.startsWith("/sefi") || pathname.startsWith("/lumen");
  const nl = language === "nl";
  const mailId = pathname.match(/^\/inbox\/([0-9a-f-]{36})$/i)?.[1] ?? null;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // "Vraag Otis" en dergelijke elders in de app openen de chat.
  useEffect(() => {
    const onAsk = () => { setHasOpened(true); setOpen(true); };
    window.addEventListener(ASK_TEAM_EVENT, onAsk);
    return () => window.removeEventListener(ASK_TEAM_EVENT, onAsk);
  }, []);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }
  function toggle() { setHasOpened(true); setOpen((current) => !current); }

  return (
    <div className="support-chat-widget" hidden={hidden}>
      {hasOpened && (
        <section
          ref={panelRef}
          id="support-chat-panel"
          className="support-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label={nl ? "Chat met Milo en zijn team" : "Chat with Milo and his team"}
          hidden={!open}
          inert={!open}
        >
          <TeamChat language={language === "en" ? "en" : "nl"} active={open && !hidden} mailId={mailId} onClose={close} />
        </section>
      )}
      <button
        ref={launcherRef}
        type="button"
        className="support-chat-launcher"
        hidden={open}
        onClick={toggle}
        aria-label={nl ? "Chat met Milo openen" : "Open chat with Milo"}
        title={nl ? "Vraag Milo" : "Ask Milo"}
        aria-controls={hasOpened ? "support-chat-panel" : undefined}
        aria-expanded={open}
      >
        <SequenceMark size={37} gear="antenna" state="observing" title="" />
      </button>
      <style jsx>{`
        .support-chat-widget[hidden],.support-chat-panel[hidden],.support-chat-launcher[hidden]{display:none!important}
        .support-chat-widget{position:fixed;right:24px;bottom:24px;z-index:40;display:flex;flex-direction:column;align-items:flex-end;gap:12px;pointer-events:none}
        .support-chat-widget>*{pointer-events:auto}
        .support-chat-launcher{width:64px;height:64px;display:grid;place-items:center;border:1px solid rgba(199,245,111,.42);border-radius:50%;background:#1a1d16;box-shadow:0 14px 36px rgba(0,0,0,.42),inset 0 0 0 5px rgba(199,245,111,.045);cursor:pointer;transition:background .2s ease,border-color .2s ease,transform .2s ease,box-shadow .2s ease}
        .support-chat-launcher:hover{background:#22281b;border-color:var(--sf-green);box-shadow:0 16px 40px rgba(0,0,0,.48),0 0 0 4px rgba(199,245,111,.1);transform:translateY(-2px)}
        .support-chat-launcher:focus-visible{outline:2px solid var(--sf-green);outline-offset:3px}
        .support-chat-panel{width:min(440px,calc(100vw - 48px));height:min(680px,calc(100dvh - 112px));min-height:320px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--sf-border-strong);border-radius:18px;background:var(--sf-surface);box-shadow:0 24px 70px rgba(0,0,0,.5)}
        @media(max-width:600px){.support-chat-widget{right:12px;bottom:calc(12px + env(safe-area-inset-bottom))}.support-chat-panel{width:calc(100vw - 24px);height:calc(100dvh - 102px - env(safe-area-inset-bottom))}.support-chat-launcher{width:56px;height:56px}}
        @media(prefers-reduced-motion:reduce){.support-chat-launcher{transition:none}.support-chat-launcher:hover{transform:none}}
      `}</style>
    </div>
  );
}
