"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { SequenceMark } from "@/components/marketing/SequenceMark";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

const LumenClient = dynamic(() => import("@/app/(app)/lumen/LumenClient"), { ssr: false });

export function SupportChatWidget({ sidebarOpen }: { sidebarOpen: boolean }) {
  const pathname = usePathname();
  const { language } = useTranslation();
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
    if (open && !hidden) panelRef.current?.querySelector("textarea")?.focus();
  }, [open, hidden]);

  function toggle() {
    setOpen((current) => {
      if (!current) setHasOpened(true);
      return !current;
    });
  }

  return (
    <div className="support-chat-widget" hidden={hidden}>
      {hasOpened && (
        <section
          ref={panelRef}
          id="support-chat-panel"
          className="support-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label={nl ? "Chat met Sefi" : "Chat with Sefi"}
          hidden={!open}
          inert={!open}
        >
          <header className="support-chat-header">
            <SequenceMark size={32} state="idle" title="" />
            <div>
              <strong>Sefi</strong>
              <span>{nl ? "Je agent in Support One" : "Your agent in Support One"}</span>
            </div>
            <button type="button" onClick={() => { setOpen(false); launcherRef.current?.focus(); }} aria-label={nl ? "Chat sluiten" : "Close chat"}>
              <X size={18} />
            </button>
          </header>
          <LumenClient compact active={open && !hidden} />
        </section>
      )}
      <button
        ref={launcherRef}
        type="button"
        className="support-chat-launcher"
        hidden={open}
        onClick={toggle}
        aria-label={nl ? "Chat met Sefi openen" : "Open chat with Sefi"}
        title={nl ? "Vraag Sefi" : "Ask Sefi"}
        aria-controls={hasOpened ? "support-chat-panel" : undefined}
        aria-expanded={open}
      >
        <SequenceMark size={37} state="idle" title="" />
      </button>
      <style jsx>{`
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
