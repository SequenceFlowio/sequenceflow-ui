"use client";

import {
  AlertCircle,
  ArrowUp,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  CornerDownRight,
  Database,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { citedLumenSourceIds } from "@/lib/lumen/chat";
import type { LumenChatMessage, LumenSnapshot, LumenSource } from "@/lib/lumen/types";

type UiMessage = LumenChatMessage & {
  id: string;
  sources?: LumenSource[];
  stopped?: boolean;
};

function id() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function formatTime(value: string | null | undefined, language: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function inlineContent(text: string, sources: LumenSource[]) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return text.split(/(\[[a-z0-9-]+\])/gi).map((part, index) => {
    const match = part.match(/^\[([a-z0-9-]+)\]$/i);
    const source = match ? sourceById.get(match[1]) : null;
    return source ? (
      <span className="lumen-inline-source" title={`${source.label}: ${source.detail}`} key={`${part}-${index}`}>
        {source.label}
      </span>
    ) : <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function LumenAnswer({ content, sources }: { content: string; sources: LumenSource[] }) {
  const lines = content.split("\n");
  const cited = citedLumenSourceIds(content, sources)
    .map((sourceId) => sources.find((source) => source.id === sourceId))
    .filter((source): source is LumenSource => Boolean(source));

  return (
    <div>
      <div className="lumen-answer-copy">
        {lines.map((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) return <div className="lumen-answer-space" key={index} />;
          if (trimmed.startsWith("### ")) return <h4 key={index}>{inlineContent(trimmed.slice(4), sources)}</h4>;
          if (trimmed.startsWith("## ")) return <h3 key={index}>{inlineContent(trimmed.slice(3), sources)}</h3>;
          if (trimmed.startsWith("# ")) return <h3 key={index}>{inlineContent(trimmed.slice(2), sources)}</h3>;
          if (/^[-*]\s/.test(trimmed)) {
            return <div className="lumen-answer-bullet" key={index}><span>•</span><p>{inlineContent(trimmed.slice(2), sources)}</p></div>;
          }
          if (/^\d+\.\s/.test(trimmed)) {
            const marker = trimmed.match(/^(\d+)\.\s/)?.[1];
            return <div className="lumen-answer-bullet" key={index}><span>{marker}.</span><p>{inlineContent(trimmed.replace(/^\d+\.\s/, ""), sources)}</p></div>;
          }
          return <p key={index}>{inlineContent(trimmed, sources)}</p>;
        })}
      </div>
      {cited.length > 0 ? (
        <div className="lumen-cited-sources" aria-label="Gebruikte bronnen">
          {cited.map((source) => (
            <span key={source.id}><Database size={12} />{source.label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function LumenClient() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [snapshot, setSnapshot] = useState<LumenSnapshot | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadContext = useCallback(async () => {
    setContextError(null);
    try {
      const response = await fetch(`/api/lumen/context?language=${language}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (nl ? "Context laden mislukt." : "Could not load context."));
      setSnapshot(data);
    } catch (error) {
      setContextError(error instanceof Error ? error.message : (nl ? "Context laden mislukt." : "Could not load context."));
    }
  }, [language, nl]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(144, Math.max(48, textarea.scrollHeight))}px`;
  }, [draft]);

  const readySources = snapshot?.sources.filter((source) => source.status === "ready").length ?? 0;
  const sourceSummary = useMemo(() => {
    if (!snapshot) return nl ? "Context laden" : "Loading context";
    if (!readySources) return nl ? "Wacht op databronnen" : "Waiting for data sources";
    return nl ? `${readySources} bronnen actief` : `${readySources} sources active`;
  }, [nl, readySources, snapshot]);

  async function sendQuestion(question: string) {
    const value = question.trim();
    if (!value || streaming) return;
    const userMessage: UiMessage = { id: id(), role: "user", content: value };
    const assistantId = id();
    const history = [...messages, userMessage].map(({ role, content }) => ({ role, content }));
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", content: "", sources: [] },
    ]);
    setDraft("");
    setChatError(null);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/lumen/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, language }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || (nl ? "Lumen kon niet antwoorden." : "Lumen could not answer."));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        buffer += decoder.decode(chunk ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const item = JSON.parse(line) as {
            type: "meta" | "delta" | "done" | "error";
            content?: string;
            message?: string;
            sources?: LumenSource[];
          };
          if (item.type === "meta") {
            setMessages((current) => current.map((message) =>
              message.id === assistantId ? { ...message, sources: item.sources ?? [] } : message));
          }
          if (item.type === "delta" && item.content) {
            setMessages((current) => current.map((message) =>
              message.id === assistantId ? { ...message, content: message.content + item.content } : message));
          }
          if (item.type === "error") throw new Error(item.message || (nl ? "Antwoord afgebroken." : "Answer interrupted."));
        }
        if (done) break;
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages((current) => current.map((message) =>
          message.id === assistantId ? { ...message, stopped: true } : message));
      } else {
        const message = error instanceof Error ? error.message : (nl ? "Lumen kon niet antwoorden." : "Lumen could not answer.");
        setChatError(message);
        setMessages((current) => current.filter((item) => item.id !== assistantId || item.content));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }

  function resetChat() {
    abortRef.current?.abort();
    setMessages([]);
    setDraft("");
    setChatError(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <main className="lumen-page">
      <div className="lumen-heading">
        <div className="lumen-brand-lockup">
          <div className="lumen-mark" aria-hidden="true">
            <BrainCircuit size={25} strokeWidth={1.7} />
            <span />
          </div>
          <div>
            <div className="lumen-title-row">
              <h1>Lumen</h1>
              <span className="lumen-beta">BETA</span>
            </div>
            <p>{nl ? "Vraag je operatie. Krijg een antwoord met bewijs." : "Ask your operation. Get an answer with evidence."}</p>
          </div>
        </div>
        {messages.length ? (
          <button className="lumen-reset" type="button" onClick={resetChat}>
            <RotateCcw size={15} /> {nl ? "Nieuwe chat" : "New chat"}
          </button>
        ) : null}
      </div>

      <section className="lumen-context-bar" aria-label={nl ? "Beschikbare databronnen" : "Available data sources"}>
        <div className="lumen-context-state">
          <span className={readySources ? "lumen-live-dot" : "lumen-live-dot lumen-live-dot--idle"} />
          <div>
            <strong>{sourceSummary}</strong>
            <span>{nl ? "Veilige, read-only context · laatste 30 dagen" : "Safe, read-only context · last 30 days"}</span>
          </div>
        </div>
        <div className="lumen-source-strip">
          {(snapshot?.sources ?? []).map((source) => (
            <span className={`lumen-source lumen-source--${source.status}`} key={source.id} title={source.detail}>
              {source.status === "ready" ? <CheckCircle2 size={13} /> : source.status === "unavailable" ? <AlertCircle size={13} /> : <Clock3 size={13} />}
              {source.label}
            </span>
          ))}
          {!snapshot && !contextError ? (
            <>
              <span className="lumen-source-skeleton" />
              <span className="lumen-source-skeleton" />
              <span className="lumen-source-skeleton" />
            </>
          ) : null}
        </div>
        {snapshot ? (
          <span className="lumen-context-time">{formatTime(snapshot.generatedAt, language)}</span>
        ) : null}
      </section>

      {contextError ? (
        <div className="lumen-error" role="alert">
          <AlertCircle size={17} />
          <span>{contextError}</span>
          <button type="button" onClick={loadContext}>{nl ? "Opnieuw proberen" : "Try again"}</button>
        </div>
      ) : null}

      <section className="lumen-workspace">
        <div className="lumen-conversation" aria-live="polite">
          {!messages.length ? (
            <div className="lumen-empty">
              <div className="lumen-empty-symbol"><Sparkles size={24} /></div>
              <h2>{nl ? "Waar wil je induiken?" : "What do you want to explore?"}</h2>
              <p>{nl ? "Lumen verbindt klantcontact, kennis en commerce tot één helder antwoord." : "Lumen connects support, knowledge and commerce into one clear answer."}</p>
              <div className="lumen-suggestions">
                {(snapshot?.suggestions ?? [
                  nl ? "Hoe kan ik voor minder klantvragen zorgen?" : "How can I reduce customer questions?",
                  nl ? "Welke data ontbreekt nog voor een goede analyse?" : "Which data is still missing for a useful analysis?",
                ]).map((suggestion) => (
                  <button type="button" onClick={() => sendQuestion(suggestion)} key={suggestion} disabled={streaming}>
                    <Sparkles size={15} />
                    <span>{suggestion}</span>
                    <CornerDownRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="lumen-message-list">
              {messages.map((message) => (
                <article className={`lumen-message lumen-message--${message.role}`} key={message.id}>
                  {message.role === "assistant" ? (
                    <div className="lumen-message-mark"><BrainCircuit size={17} /></div>
                  ) : null}
                  <div className="lumen-message-body">
                    {message.role === "assistant" ? (
                      message.content ? <LumenAnswer content={message.content} sources={message.sources ?? []} /> : (
                        <div className="lumen-thinking" aria-label={nl ? "Lumen denkt" : "Lumen is thinking"}>
                          <span /><span /><span />
                        </div>
                      )
                    ) : <p>{message.content}</p>}
                    {message.stopped ? <span className="lumen-stopped">{nl ? "Gestopt" : "Stopped"}</span> : null}
                  </div>
                </article>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="lumen-composer-shell">
          {chatError ? <div className="lumen-composer-error" role="alert"><AlertCircle size={14} />{chatError}</div> : null}
          <div className="lumen-composer">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendQuestion(draft);
                }
              }}
              placeholder={nl ? "Vraag bijvoorbeeld: hoe kan ik voor minder klantvragen zorgen?" : "Ask for example: how can I reduce customer questions?"}
              aria-label={nl ? "Stel Lumen een vraag" : "Ask Lumen a question"}
              rows={1}
              maxLength={4_000}
              disabled={streaming}
            />
            {streaming ? (
              <button className="lumen-send lumen-send--stop" type="button" onClick={() => abortRef.current?.abort()} aria-label={nl ? "Stop antwoord" : "Stop answer"}>
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button className="lumen-send" type="button" onClick={() => sendQuestion(draft)} disabled={!draft.trim()} aria-label={nl ? "Verstuur vraag" : "Send question"}>
                <ArrowUp size={18} />
              </button>
            )}
          </div>
          <div className="lumen-composer-meta">
            <span><ShieldCheck size={13} />{nl ? "Read-only: Lumen voert niets uit" : "Read-only: Lumen performs no actions"}</span>
            <span>{draft.length.toLocaleString(language)}/4.000</span>
          </div>
        </div>
      </section>

      <style jsx>{`
        .lumen-page{width:min(100%,1120px);margin:0 auto;padding:40px 24px 56px;display:grid;gap:16px}
        .lumen-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:4px}
        .lumen-brand-lockup{display:flex;align-items:center;gap:14px;min-width:0}
        .lumen-mark{width:52px;height:52px;border:1px solid rgba(199,245,111,.7);border-radius:8px;background:var(--surface);display:grid;place-items:center;color:var(--tone-success-strong);position:relative;overflow:hidden;box-shadow:0 10px 28px rgba(82,110,20,.1)}
        .lumen-mark span{position:absolute;left:7px;right:7px;height:1px;background:var(--brand);animation:lumen-scan 3.4s ease-in-out infinite}
        @keyframes lumen-scan{0%,100%{top:10px;opacity:0}20%,80%{opacity:.75}50%{top:41px}}
        .lumen-title-row{display:flex;align-items:center;gap:9px}
        .lumen-title-row h1{font-size:34px;font-weight:800;line-height:1;margin:0;letter-spacing:0}
        .lumen-beta{font-size:9px;font-weight:800;line-height:1;padding:5px 6px;border-radius:5px;background:rgba(199,245,111,.18);color:var(--tone-success-strong);border:1px solid rgba(199,245,111,.35)}
        .lumen-brand-lockup p{margin:7px 0 0;color:var(--muted);font-size:14px;line-height:1.5}
        .lumen-reset{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);padding:9px 12px;font:inherit;font-weight:650;cursor:pointer}
        .lumen-context-bar{border:1px solid var(--border);border-radius:8px;background:var(--surface);min-height:72px;padding:12px 14px;display:flex;align-items:center;gap:18px;box-shadow:0 8px 30px rgba(15,23,42,.035)}
        .lumen-context-state{display:flex;align-items:center;gap:10px;padding-right:18px;border-right:1px solid var(--border);flex-shrink:0}
        .lumen-context-state>div{display:grid;gap:2px}
        .lumen-context-state strong{font-size:13px}
        .lumen-context-state span:not(.lumen-live-dot){font-size:11px;color:var(--muted)}
        .lumen-live-dot{width:8px;height:8px;border-radius:50%;background:#7bbd16;box-shadow:0 0 0 5px rgba(123,189,22,.1);animation:lumen-live 2.4s ease-in-out infinite}
        .lumen-live-dot--idle{background:#b0b6c0;box-shadow:0 0 0 5px rgba(176,182,192,.1);animation:none}
        @keyframes lumen-live{50%{box-shadow:0 0 0 8px rgba(123,189,22,0)}}
        .lumen-source-strip{display:flex;align-items:center;gap:7px;min-width:0;flex:1;overflow:hidden}
        .lumen-source{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:11px;font-weight:700;white-space:nowrap;color:var(--muted);background:var(--surface-subtle)}
        .lumen-source--ready{color:var(--tone-success-strong);border-color:rgba(199,245,111,.4);background:rgba(199,245,111,.08)}
        .lumen-source--unavailable{color:#b42318;border-color:rgba(239,68,68,.28);background:rgba(239,68,68,.06)}
        .lumen-source-skeleton{height:28px;width:100px;border-radius:6px;background:var(--surface-subtle-strong);animation:lumen-fade 1.4s ease-in-out infinite}
        @keyframes lumen-fade{50%{opacity:.45}}
        .lumen-context-time{font-size:10px;color:var(--muted);white-space:nowrap}
        .lumen-error{border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.06);border-radius:8px;padding:11px 13px;display:flex;align-items:center;gap:9px;color:#b42318;font-size:13px}
        .lumen-error span{flex:1}.lumen-error button{border:0;background:none;color:inherit;font:inherit;font-weight:750;cursor:pointer}
        .lumen-workspace{min-height:610px;border:1px solid var(--border);border-radius:8px;background:var(--surface);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 18px 55px rgba(15,23,42,.05)}
        .lumen-conversation{flex:1;min-height:0;overflow:auto;padding:24px}
        .lumen-empty{min-height:440px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px}
        .lumen-empty-symbol{width:48px;height:48px;border-radius:8px;display:grid;place-items:center;color:var(--tone-success-strong);background:rgba(199,245,111,.12);border:1px solid rgba(199,245,111,.28);margin-bottom:17px}
        .lumen-empty h2{font-size:24px;letter-spacing:0;margin:0 0 8px}.lumen-empty>p{font-size:14px;color:var(--muted);max-width:520px;margin:0 0 28px;line-height:1.6}
        .lumen-suggestions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:min(100%,720px)}
        .lumen-suggestions button{min-height:52px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);display:grid;grid-template-columns:18px 1fr 18px;align-items:center;gap:9px;text-align:left;padding:11px 13px;font:inherit;font-size:13px;cursor:pointer}
        .lumen-suggestions button:hover{border-color:rgba(122,167,28,.55);background:rgba(199,245,111,.055)}.lumen-suggestions button svg:first-child{color:var(--tone-success-strong)}.lumen-suggestions button svg:last-child{color:var(--muted)}
        .lumen-message-list{width:min(100%,820px);margin:0 auto;display:grid;gap:28px;padding:10px 0 20px}
        .lumen-message{display:flex;gap:11px;align-items:flex-start}
        .lumen-message--user{justify-content:flex-end}
        .lumen-message-mark{width:32px;height:32px;border:1px solid rgba(199,245,111,.4);border-radius:7px;background:rgba(199,245,111,.1);color:var(--tone-success-strong);display:grid;place-items:center;flex-shrink:0}
        .lumen-message-body{min-width:0;max-width:calc(100% - 45px)}
        .lumen-message--user .lumen-message-body{max-width:min(78%,680px);padding:11px 14px;border-radius:8px;background:var(--sf-text);color:var(--sf-bg)}
        .lumen-message--user p{margin:0;white-space:pre-wrap;line-height:1.55}
        .lumen-answer-copy{font-size:14px;line-height:1.72;color:var(--text)}
        .lumen-answer-copy p{margin:0 0 10px}.lumen-answer-copy h3{font-size:16px;margin:18px 0 8px;letter-spacing:0}.lumen-answer-copy h4{font-size:14px;margin:16px 0 7px;letter-spacing:0}
        .lumen-answer-space{height:4px}.lumen-answer-bullet{display:grid;grid-template-columns:22px 1fr;gap:4px;margin:0 0 7px}.lumen-answer-bullet>span{font-weight:750;color:var(--tone-success-strong)}.lumen-answer-bullet p{margin:0}
        .lumen-cited-sources{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}.lumen-cited-sources span,.lumen-inline-source{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:5px;background:var(--surface-subtle);color:var(--muted);font-size:10px;font-weight:750;padding:4px 6px}
        .lumen-inline-source{vertical-align:middle;margin:0 2px;padding:2px 5px;color:var(--tone-success-strong);border-color:rgba(199,245,111,.32);background:rgba(199,245,111,.08)}
        .lumen-thinking{height:32px;display:flex;align-items:center;gap:4px}.lumen-thinking span{width:6px;height:6px;border-radius:50%;background:var(--tone-success-strong);animation:lumen-thinking 1.1s ease-in-out infinite}.lumen-thinking span:nth-child(2){animation-delay:.14s}.lumen-thinking span:nth-child(3){animation-delay:.28s}
        @keyframes lumen-thinking{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
        .lumen-stopped{display:inline-block;margin-top:7px;font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:800}
        .lumen-composer-shell{border-top:1px solid var(--border);padding:14px 18px 13px;background:var(--surface-subtle)}
        .lumen-composer-error{width:min(100%,820px);margin:0 auto 8px;display:flex;align-items:center;gap:7px;color:#b42318;font-size:12px}
        .lumen-composer{width:min(100%,820px);margin:0 auto;display:flex;align-items:flex-end;gap:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:7px 7px 7px 13px;box-shadow:0 8px 28px rgba(15,23,42,.055)}
        .lumen-composer:focus-within{border-color:rgba(109,153,22,.65);box-shadow:0 0 0 3px rgba(199,245,111,.12),0 8px 28px rgba(15,23,42,.055)}
        .lumen-composer textarea{flex:1;min-width:0;min-height:48px;max-height:144px;border:0;outline:0;resize:none;background:transparent;color:var(--text);font:inherit;font-size:14px;line-height:1.5;padding:13px 2px;overflow:auto}.lumen-composer textarea::placeholder{color:var(--muted)}
        .lumen-send{width:42px;height:42px;border:0;border-radius:7px;background:var(--brand);color:#1a1a1a;display:grid;place-items:center;cursor:pointer;flex-shrink:0}.lumen-send:disabled{opacity:.35;cursor:not-allowed}.lumen-send--stop{background:var(--sf-text);color:var(--sf-bg)}
        .lumen-composer-meta{width:min(100%,820px);margin:7px auto 0;display:flex;justify-content:space-between;align-items:center;gap:12px;color:var(--muted);font-size:10px}.lumen-composer-meta span{display:flex;align-items:center;gap:5px}
        @media(max-width:800px){.lumen-page{padding:20px 16px 32px}.lumen-context-bar{align-items:flex-start;flex-wrap:wrap}.lumen-context-state{border-right:0;padding-right:0}.lumen-source-strip{order:3;flex-basis:100%;overflow:auto;padding-bottom:2px}.lumen-context-time{margin-left:auto}.lumen-workspace{min-height:calc(100vh - 260px)}.lumen-conversation{padding:18px 14px}.lumen-empty{min-height:380px;padding:16px}.lumen-suggestions{grid-template-columns:1fr}.lumen-message--user .lumen-message-body{max-width:88%}}
        @media(max-width:520px){.lumen-heading{align-items:flex-start}.lumen-reset{width:38px;height:38px;padding:0;justify-content:center}.lumen-reset :global(svg){margin:0}.lumen-reset{font-size:0}.lumen-mark{width:44px;height:44px}.lumen-title-row h1{font-size:30px}.lumen-context-time{display:none}.lumen-composer-shell{padding:11px}.lumen-composer-meta span:last-child{display:none}}
        @media(prefers-reduced-motion:reduce){.lumen-mark span,.lumen-live-dot,.lumen-thinking span,.lumen-source-skeleton{animation:none}}
      `}</style>
    </main>
  );
}
