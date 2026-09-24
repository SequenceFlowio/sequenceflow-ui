"use client";

import {
  AlertCircle,
  ArrowUp,
  CornerDownRight,
  Database,
  RotateCcw,
  Square,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { SequenceMark } from "@/components/marketing/SequenceMark";
import { citedLumenSourceIds } from "@/lib/lumen/chat";
import type { LumenChatMessage, LumenSnapshot, LumenSource } from "@/lib/lumen/types";

type UiMessage = LumenChatMessage & {
  id: string;
  sources?: LumenSource[];
  stopped?: boolean;
  knowledgeUnavailable?: boolean;
};

function id() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
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

export default function LumenClient({ compact = false, active = true }: { compact?: boolean; active?: boolean }) {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [snapshot, setSnapshot] = useState<LumenSnapshot | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // De context levert alleen de voorbeeldvragen; de chat haalt zelf verse
  // context op. Mislukt dit, dan blijven de standaardvoorbeelden staan.
  const loadContext = useCallback(async () => {
    try {
      const response = await fetch(`/api/lumen/context?language=${language}`, { cache: "no-store" });
      if (response.ok) setSnapshot(await response.json());
    } catch {
      // Stil: de standaardvoorbeelden volstaan.
    }
  }, [language]);

  useEffect(() => {
    if (active) void loadContext();
  }, [active, loadContext]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(144, Math.max(48, textarea.scrollHeight))}px`;
  }, [draft]);

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
        throw new Error(data.error || (nl ? "Support One kon niet antwoorden." : "Support One could not answer."));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedContent = false;
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
            knowledgeAvailable?: boolean;
          };
          if (item.type === "meta") {
            setMessages((current) => current.map((message) =>
              message.id === assistantId ? { ...message, sources: item.sources ?? [], knowledgeUnavailable: item.knowledgeAvailable === false } : message));
          }
          if (item.type === "delta" && item.content) {
            receivedContent = true;
            setMessages((current) => current.map((message) =>
              message.id === assistantId ? { ...message, content: message.content + item.content } : message));
          }
          if (item.type === "error") throw new Error(item.message || (nl ? "Antwoord afgebroken." : "Answer interrupted."));
        }
        if (done) break;
      }
      if (!receivedContent) throw new Error(nl ? "Sefi gaf nog geen antwoord. Probeer het opnieuw." : "Sefi did not answer yet. Please try again.");
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages((current) => current.map((message) =>
          message.id === assistantId ? { ...message, stopped: true } : message));
      } else {
        const message = error instanceof Error ? error.message : (nl ? "Support One kon niet antwoorden." : "Support One could not answer.");
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

  const Root = compact ? "div" : "main";

  return (
    <Root className={`lumen-page${compact ? " lumen-page--compact" : ""}`}>
      <div className={`lumen-heading${compact && !messages.length ? " lumen-heading--empty" : ""}`}>
        <div>
          <h1>Sefi</h1>
          <p>{nl ? "Je agent in Support One. Stel vragen over je klantcontact en krijg inzicht uit je eigen gegevens." : "Your agent in Support One. Ask about your customer support and get insights from your own data."}</p>
        </div>
        {messages.length ? (
          <button className="lumen-reset" type="button" onClick={resetChat}>
            <RotateCcw size={15} /> {nl ? "Nieuwe chat" : "New chat"}
          </button>
        ) : null}
      </div>

      <section className="lumen-workspace">
        <div className="lumen-conversation" aria-live="polite">
          {!messages.length ? (
            <div className="lumen-empty">
              <SequenceMark size={76} state="idle" followPointer={240} title="" />
              <h2>{nl ? "Wat wil je Sefi laten onderzoeken?" : "What should Sefi investigate?"}</h2>
              <p>{nl ? "Sefi onderzoekt je klantvragen, kennis en beschikbare bestelgegevens. Bij het antwoord zie je welke bronnen zijn gebruikt. Sefi verandert niets in je account." : "Sefi explores your customer questions, knowledge and available order data. The answer shows which sources were used. Sefi does not change your account."}</p>
              <div className="lumen-suggestions">
                {(snapshot?.suggestions ?? [
                  nl ? "Hoe kan ik voor minder klantvragen zorgen?" : "How can I reduce customer questions?",
                  nl ? "Welke data ontbreekt nog voor een goede analyse?" : "Which data is still missing for a useful analysis?",
                ]).map((suggestion) => (
                  <button type="button" onClick={() => sendQuestion(suggestion)} key={suggestion} disabled={streaming}>
                    <span>{suggestion}</span>
                    <CornerDownRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="lumen-message-list">
              {messages.map((message, index) => {
                // Sefi blijft zichtbaar onderzoeken zolang dit antwoord nog binnenkomt,
                // niet alleen tot het eerste woord: korte antwoorden zijn er anders
                // vrijwel meteen en dan zie je de animatie nooit.
                const working = streaming && index === messages.length - 1 && !message.stopped;
                return (
                <article className={`lumen-message lumen-message--${message.role}`} key={message.id}>
                  {message.role === "assistant" ? (
                    <div className="lumen-message-mark"><SequenceMark size={working ? 42 : 25} state={working ? "investigating" : "reading"} title="" /></div>
                  ) : null}
                  <div className="lumen-message-body">
                    {message.role === "assistant" ? (
                      message.content ? <>
                        {message.knowledgeUnavailable ? <p className="lumen-knowledge-warning"><AlertCircle size={14} />{nl ? "Kenniszoeken was niet beschikbaar voor dit antwoord; controleer claims over je beleid." : "Knowledge search was unavailable for this answer; verify claims about your policies."}</p> : null}
                        <LumenAnswer content={message.content} sources={message.sources ?? []} />
                      </> : message.stopped ? null : (
                        <div className="lumen-research" role="status" aria-label={nl ? "Sefi onderzoekt je vraag" : "Sefi is investigating your question"}>
                          <strong>{nl ? "Sefi onderzoekt je vraag" : "Sefi is investigating your question"}<span className="lumen-research-dots" aria-hidden="true">...</span></strong>
                          {/* Drie bronregels die om de beurt worden "gelezen", in het ritme
                              waarin Sefi's ogen regel voor regel scannen. */}
                          <span className="lumen-research-lines" aria-hidden="true"><i /><i /><i /></span>
                        </div>
                      )
                    ) : <p>{message.content}</p>}
                    {message.stopped ? <span className="lumen-stopped">{nl ? "Gestopt" : "Stopped"}</span> : null}
                  </div>
                </article>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="lumen-composer-shell">
          {chatError ? <div className="lumen-composer-error" role="alert"><AlertCircle size={14} />{chatError}</div> : null}
          <div className="lumen-composer">
            <textarea
              ref={textareaRef}
              autoFocus={compact}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendQuestion(draft);
                }
              }}
              placeholder={nl ? "Vraag bijvoorbeeld: hoe kan ik voor minder klantvragen zorgen?" : "Ask for example: how can I reduce customer questions?"}
              aria-label={nl ? "Stel Sefi een vraag" : "Ask Sefi a question"}
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
        </div>
      </section>

      <style jsx>{`
        .lumen-page{width:min(100%,1080px);margin:0 auto;padding:40px 24px 56px;display:grid;gap:18px}
        .lumen-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
        .lumen-heading h1{font-size:30px;font-weight:500;line-height:1.15;letter-spacing:-.02em;margin:0}
        .lumen-heading p{margin:7px 0 0;color:var(--muted);font-size:14px;line-height:1.5}
        .lumen-reset{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);padding:9px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
        .lumen-reset:hover{background:var(--surface-2)}
        .lumen-knowledge-warning{display:flex;align-items:center;gap:7px;color:var(--tone-warning);font-size:12px;line-height:1.5;margin:0 0 12px}
        .lumen-workspace{min-height:610px;border:1px solid var(--border);border-radius:20px;background:var(--surface);display:flex;flex-direction:column;overflow:hidden}
        .lumen-conversation{flex:1;min-height:0;overflow:auto;padding:24px}
        .lumen-empty{min-height:440px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px}
        .lumen-empty h2{font-size:24px;font-weight:500;letter-spacing:-.01em;margin:18px 0 8px}.lumen-empty>p{font-size:14px;color:var(--muted);max-width:520px;margin:0 0 28px;line-height:1.6}
        .lumen-suggestions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:min(100%,720px)}
        .lumen-suggestions button{min-height:52px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);color:var(--text);display:grid;grid-template-columns:1fr 18px;align-items:center;gap:9px;text-align:left;padding:12px 14px;font:inherit;font-size:13px;cursor:pointer}
        .lumen-suggestions button:hover{border-color:rgba(199,245,111,.35);background:rgba(199,245,111,.06)}.lumen-suggestions button svg{color:var(--muted)}
        .lumen-message-list{width:min(100%,820px);margin:0 auto;display:grid;gap:28px;padding:10px 0 20px}
        .lumen-message{display:flex;gap:11px;align-items:flex-start}
        .lumen-message--user{justify-content:flex-end}
        .lumen-message-mark{width:44px;min-height:42px;display:grid;place-items:start center;flex-shrink:0}
        .lumen-message-body{min-width:0;max-width:calc(100% - 55px)}
        .lumen-message--user .lumen-message-body{max-width:min(78%,680px);padding:11px 15px;border-radius:16px 16px 4px 16px;background:var(--surface-2);border:1px solid var(--border);color:var(--text)}
        .lumen-message--user p{margin:0;white-space:pre-wrap;line-height:1.55}
        .lumen-answer-copy{font-size:14px;line-height:1.72;color:var(--text)}
        .lumen-answer-copy p{margin:0 0 10px}.lumen-answer-copy h3{font-size:16px;font-weight:500;margin:18px 0 8px;letter-spacing:0}.lumen-answer-copy h4{font-size:14px;font-weight:600;margin:16px 0 7px;letter-spacing:0}
        .lumen-answer-space{height:4px}.lumen-answer-bullet{display:grid;grid-template-columns:22px 1fr;gap:4px;margin:0 0 7px}.lumen-answer-bullet>span{font-weight:600;color:var(--sf-green)}.lumen-answer-bullet p{margin:0}
        .lumen-cited-sources{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}.lumen-cited-sources span,.lumen-inline-source{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:500;padding:4px 9px}
        .lumen-inline-source{vertical-align:middle;margin:0 2px;padding:2px 7px;color:var(--sf-green);border-color:rgba(199,245,111,.32);background:rgba(199,245,111,.08)}
        .lumen-research{display:grid;gap:9px;min-width:min(250px,calc(100vw - 125px));padding:12px 16px;border:1px solid rgba(199,245,111,.2);border-radius:14px;background:rgba(199,245,111,.045)}
        .lumen-research strong{font-size:13px;font-weight:600;color:var(--text)}
        .lumen-research-dots{color:var(--sf-green);letter-spacing:.14em}
        .lumen-research-lines{display:grid;gap:8px;padding-top:2px}
        .lumen-research-lines i{position:relative;display:block;height:7px;overflow:hidden;border-radius:4px;background:rgba(255,255,255,.07)}
        .lumen-research-lines i:nth-child(1){width:92%}.lumen-research-lines i:nth-child(2){width:74%}.lumen-research-lines i:nth-child(3){width:84%}
        .lumen-research-lines i::after{content:"";position:absolute;inset:0;width:34%;border-radius:inherit;background:var(--sf-green);opacity:0;animation:lumen-read 3.4s linear infinite}
        .lumen-research-lines i:nth-child(2)::after{animation-delay:1.13s}.lumen-research-lines i:nth-child(3)::after{animation-delay:2.27s}
        @keyframes lumen-read{0%{opacity:.85;transform:translateX(-100%)}31%{opacity:.85;transform:translateX(300%)}33.3%,100%{opacity:0;transform:translateX(300%)}}
        .lumen-stopped{display:inline-block;margin-top:7px;font-size:11px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;font-weight:600}
        .lumen-composer-shell{border-top:1px solid var(--border);padding:14px 18px 16px}
        .lumen-composer-error{width:min(100%,820px);margin:0 auto 8px;display:flex;align-items:center;gap:7px;color:var(--tone-danger);font-size:12px}
        .lumen-composer{width:min(100%,820px);margin:0 auto;display:flex;align-items:flex-end;gap:10px;border:1px solid var(--border);border-radius:16px;background:var(--surface-2);padding:7px 7px 7px 14px}
        .lumen-composer:focus-within{border-color:rgba(199,245,111,.45);box-shadow:0 0 0 3px rgba(199,245,111,.12)}
        .lumen-composer textarea{flex:1;min-width:0;min-height:48px;max-height:144px;border:0;outline:0;resize:none;background:transparent;color:var(--text);font:inherit;font-size:14px;line-height:1.5;padding:13px 2px;overflow:auto}.lumen-composer textarea::placeholder{color:var(--muted)}
        .lumen-send{width:42px;height:42px;border:0;border-radius:12px;background:var(--sf-green);color:#10180a;display:grid;place-items:center;cursor:pointer;flex-shrink:0}.lumen-send:disabled{opacity:.35;cursor:not-allowed}.lumen-send--stop{background:var(--sf-text);color:var(--sf-bg)}
        @media(max-width:800px){.lumen-page{padding:20px 16px 32px}.lumen-workspace{min-height:calc(100vh - 200px)}.lumen-conversation{padding:18px 14px}.lumen-empty{min-height:380px;padding:16px}.lumen-suggestions{grid-template-columns:1fr}.lumen-message--user .lumen-message-body{max-width:88%}}
        @media(max-width:520px){.lumen-heading{align-items:flex-start}.lumen-reset{width:38px;height:38px;padding:0;justify-content:center;font-size:0}.lumen-composer-shell{padding:11px}}
        .lumen-page--compact{width:100%;height:100%;min-height:0;padding:0;gap:0;display:flex;flex-direction:column}
        .lumen-page--compact .lumen-heading{padding:0 18px 12px;align-items:center}
        .lumen-page--compact .lumen-heading>div{display:none}
        .lumen-page--compact .lumen-heading--empty{display:none}
        .lumen-page--compact .lumen-reset{margin-left:auto;padding:5px 9px;font-size:11px}
        .lumen-page--compact .lumen-workspace{min-height:0;flex:1;border:0;border-radius:0}
        .lumen-page--compact .lumen-conversation{padding:18px}
        .lumen-page--compact .lumen-empty{min-height:100%;padding:16px 6px}
        .lumen-page--compact .lumen-empty h2{font-size:19px;margin:12px 0 7px}
        .lumen-page--compact .lumen-empty>p{font-size:12px;margin-bottom:20px}
        .lumen-page--compact .lumen-suggestions{grid-template-columns:1fr}
        .lumen-page--compact .lumen-suggestions button{min-height:44px;font-size:12px}
        .lumen-page--compact .lumen-message-list{gap:18px}
        .lumen-page--compact .lumen-answer-copy{font-size:13px}
        .lumen-page--compact .lumen-composer-shell{padding:10px 12px 12px}
        .lumen-page--compact .lumen-composer textarea{font-size:13px}
        @media(prefers-reduced-motion:reduce){.lumen-research-lines i::after{animation:none;opacity:.35;transform:none}}
      `}</style>
    </Root>
  );
}
