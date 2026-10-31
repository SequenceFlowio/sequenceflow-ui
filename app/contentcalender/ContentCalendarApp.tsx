"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, isToday, nextMonday, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { nl } from "date-fns/locale";
import {
  BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Download, ImageIcon, Layers, LogOut, Plus, RefreshCw,
  Send, Sparkles, Trash2, X,
} from "lucide-react";
import { AUDIENCE, BRAND, FORMATS, NEWS, PILLARS, PROMO_RATIO, VISUAL_STYLE, VOICE, formatName } from "@/lib/contentCalendar/brand";
import { API_PATH, APP_PATH } from "@/lib/contentCalendar/paths";
import type { Post, PostStatus, Queue } from "@/lib/contentCalendar/types";

type View = "calendar" | "review" | "brand";
type Segment = "deck" | "rejected" | "approved";
interface Providers { text: "kie" | "tipbank"; image: { genai: boolean; kie: boolean }; publishing?: boolean }

const STATUS_LABEL: Record<PostStatus, string> = { review: "Te beoordelen", approved: "Goedgekeurd", rejected: "Afgekeurd", posted: "Gepost" };
const pillarName = (id: string) => PILLARS.find((p) => p.id === id)?.name ?? id;
const postLabel = (post: Post) => (post.format && post.format !== "tips" ? `${formatName(post.format)} · ${pillarName(post.pillar)}` : pillarName(post.pillar));
const slideUrl = (post: Post, index: number) => `${API_PATH}/render/${post.id}/${index}?v=${encodeURIComponent(post.updatedAt)}`;
// Directe (getekende) Supabase-links. Eenmaal ontvangen links blijven staan, zodat de browser ze cachet.
const mediaLinks: Record<string, string> = {};
const mediaUrl = (file: string) => mediaLinks[file] ?? `${API_PATH}/media/${file}`;
const slideCount = (post: Post) => post.slides.length + 2;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // paden worden geschreven als "/api/posts" en komen uit op /api/contentcalender/posts
  const response = await fetch(`${API_PATH}${path.replace(/^\/api/, "")}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (response.status === 401) { window.location.href = `${APP_PATH}/login`; throw new Error("Niet ingelogd"); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request mislukt (${response.status})`);
  return data as T;
}

/* ---------- App ---------- */

export default function ContentCalendarApp() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [view, setView] = useState<View>("calendar");
  const [openId, setOpenId] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [statusKey, setStatusKey] = useState(0);

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ posts: Post[]; queue: Queue | null; media?: Record<string, string>; providers: Providers }>("/api/posts");
      for (const [file, url] of Object.entries(data.media ?? {})) mediaLinks[file] ??= url;
      setPosts(data.posts);
      setQueue(data.queue);
      setProviders(data.providers);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Laden mislukt", true);
    } finally {
      setLoaded(true);
    }
  }, [notify]);

  const generating = posts.filter((p) => p.image.status === "generating").length;
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    // De cron doet het werk; de pagina leest alleen af en toe mee, en niet op de achtergrond.
    const busy = generating > 0 || queue?.status === "running";
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, busy ? 20000 : 120000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [generating, queue?.status, refresh]);

  const patch = useCallback(async (post: Post, body: Record<string, unknown>) => {
    setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, ...body } as Post : p)));
    try {
      const data = await api<{ post: Post }>(`/api/posts/${post.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setPosts((list) => list.map((p) => (p.id === post.id ? data.post : p)));
      return data.post;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Opslaan mislukt", true);
      void refresh();
    }
  }, [notify, refresh]);

  const replace = (post: Post) => setPosts((list) => list.map((p) => (p.id === post.id ? post : p)));
  const toReview = posts.filter((p) => p.status === "review" && p.image.status !== "generating").length;
  const openPost = posts.find((p) => p.id === openId) ?? null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img src="/logo-black.png" alt="SequenceFlow" className="logo logo-light" />
          <img src="/logo-white.png" alt="SequenceFlow" className="logo logo-dark" />
          <span className="brand-tag">Content Calendar</span>
        </div>
        <nav className="tabs">
          <button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}><CalendarDays size={15} /> Kalender</button>
          <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}><Layers size={15} /> Beoordelen{toReview ? <b>{toReview}</b> : null}</button>
          <button className={view === "brand" ? "active" : ""} onClick={() => setView("brand")}><BookOpen size={15} /> Kennisbank</button>
        </nav>
        <div className="top-actions">
          {providers && <ProviderStatusMenu providers={providers} refreshKey={statusKey} />}
          <button className="btn primary" onClick={() => setGenerateOpen(true)}><Sparkles size={15} /> Genereer posts</button>
          <button className="icon-btn" title="Uitloggen" onClick={async () => { await fetch(`${API_PATH}/access/logout`, { method: "POST" }); window.location.href = `${APP_PATH}/login`; }}><LogOut size={16} /></button>
        </div>
      </header>

      <main className="content">
        {queue?.status === "running" ? (
          <div className="banner info queue">
            <span className="pulse" />
            <span className="grow">
              <b>Wachtrij: {queue.done} van {queue.total} posts gemaakt</b>
              {generating > 0 && ` · ${generating} ${generating === 1 ? "beeld" : "beelden"} in productie`}
              {queue.lastError && <small className="queue-error"> · even gepauzeerd: {queue.lastError}</small>}
              <span className="queue-bar"><i style={{ width: `${queue.total ? (queue.done / queue.total) * 100 : 0}%` }} /></span>
              <small>Gaat ook door als je dit tabblad sluit; elke minuut worden er nieuwe posts gemaakt.</small>
            </span>
            <button className="btn secondary small" onClick={async () => { const data = await api<{ queue: Queue }>("/api/queue", { method: "DELETE" }); setQueue(data.queue); notify("Wachtrij gestopt. Gemaakte posts blijven staan."); }}>Stop</button>
          </div>
        ) : generating > 0 && <div className="banner info"><span className="pulse" /> {generating} {generating === 1 ? "beeld wordt" : "beelden worden"} gegenereerd…</div>}
        {view === "calendar" && <CalendarView posts={posts} loaded={loaded} month={month} setMonth={setMonth} onOpen={setOpenId} onMove={(post, date) => void patch(post, { date })} onGenerate={() => setGenerateOpen(true)} />}
        {view === "review" && <ReviewView posts={posts} onPatch={patch} onReplace={replace} onOpen={setOpenId} notify={notify} />}
        {view === "brand" && <BrandView />}
      </main>

      {openPost && <PostDrawer key={openPost.id} post={openPost} onClose={() => setOpenId(null)} onPatch={patch} onReplace={replace} notify={notify}
        onDelete={async () => { await api(`/api/posts/${openPost.id}`, { method: "DELETE" }); setOpenId(null); setPosts((l) => l.filter((p) => p.id !== openPost.id)); notify("Post verwijderd"); }} />}
      {generateOpen && <GenerateModal posts={posts} providers={providers} onClose={() => setGenerateOpen(false)} onDone={(count, startDate) => { setGenerateOpen(false); setStatusKey((k) => k + 1); setMonth(startOfMonth(parseISO(startDate))); setView("calendar"); notify(`${count} posts in de wachtrij gezet. Ze verschijnen één voor één.`); void refresh(); }} notify={notify} />}
      {toast && <div className={`toast ${toast.error ? "error" : ""}`}>{toast.text}</div>}
    </div>
  );
}

interface ProviderStatus {
  genai: { configured: boolean; connected: boolean; active: boolean; username?: string; balance?: number; quota?: number; used?: number; remaining?: number; hoursRemaining?: number | null; expiredAt?: string | null; error?: string };
  kie: { configured: boolean; connected: boolean; credits?: number; error?: string };
  meta?: { configured: boolean; instagram: boolean; facebook: boolean; autopublish: boolean };
}

function ProviderStatusMenu({ providers, refreshKey }: { providers: Providers; refreshKey: number }) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () => api<ProviderStatus>("/api/providers/status").then((data) => { if (alive) setStatus(data); }).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 60000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [refreshKey]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const genai = status?.genai;
  const kie = status?.kie;
  const tone = !genai ? "" : genai.active ? ((genai.remaining ?? 0) < 10 ? "warn" : "ok") : kie?.connected ? "warn" : "bad";
  const label = !genai ? "Status laden…" : !genai.configured ? "GenAI Pro niet gekoppeld" : !genai.connected ? "GenAI Pro offline" : `GenAI Pro · ${genai.remaining} over`;
  const percentage = genai?.quota ? Math.max(0, Math.min(100, ((genai.remaining ?? 0) / genai.quota) * 100)) : 0;

  return (
    <div className="status-menu" ref={ref}>
      <button className={`pill ${tone}`} onClick={() => setOpen((o) => !o)}><span className="status-dot" /> {label}</button>
      {open && status && (
        <div className="status-pop">
          <div className="status-block">
            <div className="row between"><strong><ImageIcon size={14} /> GenAI Pro</strong><span className={`pill ${genai!.connected ? "ok" : "bad"}`}>{genai!.connected ? "Verbonden" : genai!.configured ? "Geen verbinding" : "Niet gekoppeld"}</span></div>
            {genai!.error && <p className="status-error">{genai!.error}</p>}
            {genai!.connected && <>
              <div className="credits-number"><b>{genai!.remaining}</b><span>van {genai!.quota} generaties over</span></div>
              <div className="credits-bar"><i style={{ width: `${percentage}%` }} /></div>
              <p className="muted small-text">
                {genai!.active
                  ? genai!.hoursRemaining == null ? "Geen verloopdatum" : `Credits verlopen over ${genai!.hoursRemaining < 48 ? `${genai!.hoursRemaining} uur` : `${Math.floor(genai!.hoursRemaining / 24)} dagen`}`
                  : genai!.expiredAt ? `Geen actieve credits, laatste pakket verliep ${format(parseISO(genai!.expiredAt), "d MMM yyyy", { locale: nl })}. Beelden gaan nu via kie.ai.` : "Geen actieve credits. Beelden gaan nu via kie.ai."}
              </p>
              <p className="muted small-text">1 generatie = 4 fotovarianten voor 1 post · account {genai!.username}{typeof genai!.balance === "number" ? ` · saldo $${genai!.balance.toFixed(2)}` : ""}</p>
            </>}
          </div>
          <div className="status-block">
            <div className="row between"><strong><Sparkles size={14} /> kie.ai</strong><span className={`pill ${kie!.connected ? "ok" : "bad"}`}>{kie!.connected ? "Verbonden" : kie!.configured ? "Geen verbinding" : "Niet gekoppeld"}</span></div>
            {kie!.error && <p className="status-error">{kie!.error}</p>}
            {kie!.connected && <div className="credits-number"><b>{Math.floor(kie!.credits ?? 0)}</b><span>credits over</span></div>}
            <p className="muted small-text">Tekst: {providers.text === "kie" ? "Gemini 3.8 Flash" : "ingebouwde tipbank"} · backup-beelden: Nano Banana 2.1</p>
          </div>
          {status.meta && (
            <div className="status-block">
              <div className="row between"><strong><Send size={14} /> Instagram & Facebook</strong><span className={`pill ${status.meta.autopublish ? "ok" : status.meta.configured ? "warn" : "bad"}`}>{status.meta.autopublish ? "Automatisch posten aan" : status.meta.configured ? "Gekoppeld, auto uit" : "Niet gekoppeld"}</span></div>
              <p className="muted small-text">
                {status.meta.configured
                  ? `${[status.meta.instagram && "Instagram", status.meta.facebook && "Facebook"].filter(Boolean).join(" + ")} gekoppeld. ${status.meta.autopublish ? "Goedgekeurde posts gaan op hun datum en tijd live." : "Zet CONTENT_AUTOPUBLISH=true om goedgekeurde posts automatisch te posten."}`
                  : "Voeg META_ACCESS_TOKEN, META_IG_USER_ID en META_PAGE_ID toe in Vercel."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Kalender ---------- */

function CalendarView({ posts, loaded, month, setMonth, onOpen, onMove, onGenerate }: { posts: Post[]; loaded: boolean; month: Date; setMonth: React.Dispatch<React.SetStateAction<Date>>; onOpen: (id: string) => void; onMove: (post: Post, date: string) => void; onGenerate: () => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const list: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) list.push(d);
    return list;
  }, [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) map.set(post.date, [...(map.get(post.date) ?? []), post]);
    return map;
  }, [posts]);
  const inMonth = posts.filter((p) => isSameMonth(parseISO(p.date), month));
  const count = (status: PostStatus) => inMonth.filter((p) => p.status === status).length;

  return (
    <section>
      <div className="section-head">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft size={16} /></button>
          <h1>{format(month, "MMMM yyyy", { locale: nl })}</h1>
          <button className="icon-btn" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight size={16} /></button>
          <button className="btn ghost small" onClick={() => setMonth(startOfMonth(new Date()))}>Vandaag</button>
        </div>
        <div className="stats">
          <span><i className="dot review" /> {count("review")} te beoordelen</span>
          <span><i className="dot approved" /> {count("approved")} goedgekeurd</span>
          <span><i className="dot posted" /> {count("posted")} gepost</span>
        </div>
      </div>

      {loaded && !posts.length ? (
        <div className="empty">
          <div className="orb"><CalendarDays size={22} /></div>
          <h2>Nog geen posts gepland</h2>
          <p>Genereer een paar weken aan tips voor drukke ondernemers. Jij swipet daarna goed of af.</p>
          <button className="btn primary" onClick={onGenerate}><Sparkles size={15} /> Genereer posts</button>
        </div>
      ) : (
        <div className="calendar">
          {["ma", "di", "wo", "do", "vr", "za", "zo"].map((d) => <div key={d} className="weekday">{d}</div>)}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            return (
              <div key={key} className={`day ${isSameMonth(day, month) ? "" : "outside"} ${isToday(day) ? "today" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { const post = posts.find((p) => p.id === dragId); if (post && post.date !== key) onMove(post, key); setDragId(null); }}>
                <span className="day-num">{format(day, "d")}</span>
                {(byDate.get(key) ?? []).map((post) => (
                  <button key={post.id} className={`cal-post s-${post.status}`} draggable onDragStart={() => setDragId(post.id)} onClick={() => onOpen(post.id)}>
                    <Thumb post={post} />
                    <span className="cal-text"><b>{post.headline}</b><small>{post.time} · {postLabel(post)}</small></span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Thumb({ post }: { post: Post }) {
  const file = post.image.files[post.image.selected];
  if (post.image.status === "generating") return <span className="thumb loading"><RefreshCw size={12} className="spin" /></span>;
  if (file) return <img className="thumb" src={mediaUrl(file)} alt="" loading="lazy" />;
  return <span className={`thumb empty-thumb ${post.image.status === "failed" ? "failed" : ""}`}><ImageIcon size={12} /></span>;
}

/* ---------- Slides ---------- */

function SlideViewer({ post, compact = false }: { post: Post; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const total = slideCount(post);
  const go = (next: number) => setIndex(Math.max(0, Math.min(total - 1, next)));
  return (
    <div className={`slides ${compact ? "compact" : ""}`}>
      {post.image.status === "generating" && index === 0 ? (
        <div className="slide-loading"><RefreshCw className="spin" size={20} /><span>Beeld wordt gemaakt…</span></div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slideUrl(post, index)} alt={`Slide ${index + 1}`} draggable={false} />
      )}
      {index > 0 && <button className="slide-nav left" onClick={(e) => { e.stopPropagation(); go(index - 1); }}><ChevronLeft size={18} /></button>}
      {index < total - 1 && <button className="slide-nav right" onClick={(e) => { e.stopPropagation(); go(index + 1); }}><ChevronRight size={18} /></button>}
      <div className="slide-dots">{Array.from({ length: total }).map((_, i) => <button key={i} className={i === index ? "on" : ""} onClick={(e) => { e.stopPropagation(); go(i); }} />)}</div>
    </div>
  );
}

/* ---------- Beoordelen (swipe) ---------- */

function SwipeCard({ post, onApprove, onReject, onSelect }: { post: Post; onApprove: () => void; onReject: () => void; onSelect: (index: number) => void }) {
  const [drag, setDrag] = useState({ x: 0, active: false });
  const startX = useRef(0);
  const onPointerDown = (event: React.PointerEvent) => {
    // niet slepen vanaf knoppen (slide-navigatie), anders eet de kaart de klik op
    if ((event.target as HTMLElement).closest("button")) return;
    startX.current = event.clientX;
    setDrag({ x: 0, active: true });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => { if (drag.active) setDrag({ x: event.clientX - startX.current, active: true }); };
  const onPointerUp = () => {
    if (!drag.active) return;
    if (drag.x > 110) onApprove();
    else if (drag.x < -110) onReject();
    setDrag({ x: 0, active: false });
  };

  return (
    <div className={`swipe-card ${drag.active ? "dragging" : ""}`} style={{ transform: `translateX(${drag.x}px) rotate(${drag.x / 22}deg)` }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      {drag.x > 40 && <span className="swipe-hint yes" style={{ opacity: Math.min(1, drag.x / 120) }}><Check size={16} /> Goedkeuren</span>}
      {drag.x < -40 && <span className="swipe-hint no" style={{ opacity: Math.min(1, -drag.x / 120) }}><X size={16} /> Afkeuren</span>}
      <SlideViewer post={post} />
      {post.image.files.length > 1 && (
        <div className="swipe-variants">
          {post.image.files.map((file, i) => (
            <button key={file} className={i === post.image.selected ? "on" : ""} title={`Foto ${i + 1}`} onClick={(e) => { e.stopPropagation(); onSelect(i); }}>
              <img src={mediaUrl(file)} alt={`Foto ${i + 1}`} draggable={false} />
            </button>
          ))}
          <span>Kies de foto · 4 varianten voor 1 credit</span>
        </div>
      )}
      <div className="swipe-copy">
        <div className="swipe-meta">
          <span className="tag">{postLabel(post)}</span>
          <span className="muted">{format(parseISO(post.date), "EEEE d MMM", { locale: nl })} · {post.time}</span>
        </div>
        <p>{post.caption.split("\n")[0]}</p>
        {post.image.status === "failed" && <div className="banner error small">Geen beeld: {post.image.error}</div>}
      </div>
    </div>
  );
}

function ReviewView({ posts, onPatch, onReplace, onOpen, notify }: {
  posts: Post[];
  onPatch: (post: Post, body: Record<string, unknown>) => Promise<Post | undefined>;
  onReplace: (post: Post) => void;
  onOpen: (id: string) => void;
  notify: (text: string, error?: boolean) => void;
}) {
  const [segment, setSegment] = useState<Segment>("deck");
  const deck = posts.filter((p) => p.status === "review" && p.image.status !== "generating");
  const inProduction = posts.filter((p) => p.status === "review" && p.image.status === "generating").length;
  const rejected = posts.filter((p) => p.status === "rejected");
  const approved = posts.filter((p) => p.status === "approved");
  const current = deck[0];

  const approve = useCallback((post: Post) => void onPatch(post, { status: "approved" }), [onPatch]);
  const reject = useCallback((post: Post) => void onPatch(post, { status: "rejected" }), [onPatch]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (segment !== "deck" || !current) return;
      if (["TEXTAREA", "INPUT"].includes((event.target as HTMLElement)?.tagName)) return;
      if (event.key === "ArrowRight") approve(current);
      if (event.key === "ArrowLeft") reject(current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [segment, current, approve, reject]);

  return (
    <section className="review">
      <div className="segments">
        <button className={segment === "deck" ? "active" : ""} onClick={() => setSegment("deck")}>Te beoordelen{deck.length ? <b>{deck.length}</b> : null}</button>
        <button className={segment === "rejected" ? "active" : ""} onClick={() => setSegment("rejected")}>Afgekeurd{rejected.length ? <b>{rejected.length}</b> : null}</button>
        <button className={segment === "approved" ? "active" : ""} onClick={() => setSegment("approved")}>Goedgekeurd{approved.length ? <b>{approved.length}</b> : null}</button>
      </div>

      {segment === "deck" && (current ? (
        <div className="deck">
          <SwipeCard key={current.id} post={current} onApprove={() => approve(current)} onReject={() => reject(current)} onSelect={(index) => void onPatch(current, { selected: index, image: { ...current.image, selected: index } })} />
          <div className="deck-actions">
            <button className="deck-btn no" onClick={() => reject(current)} title="Afkeuren (←)"><X size={26} /></button>
            <button className="deck-btn detail" onClick={() => onOpen(current.id)} title="Bewerken">Bewerk</button>
            <button className="deck-btn yes" onClick={() => approve(current)} title="Goedkeuren (→)"><Check size={26} /></button>
          </div>
          <small className="muted">Swipe of gebruik ← en → · nog {deck.length} te beoordelen{inProduction ? ` · ${inProduction} in productie` : ""}</small>
        </div>
      ) : (
        <div className="empty">
          <div className="orb"><Check size={22} /></div>
          <h2>{inProduction ? `${inProduction} posts in productie` : "Alles beoordeeld"}</h2>
          <p>{inProduction ? "Zodra de beelden klaar zijn verschijnen ze hier." : "Nieuwe posts verschijnen hier zodra je ze genereert."}</p>
        </div>
      ))}

      {segment === "rejected" && (rejected.length ? (
        <div className="stack">{rejected.map((post) => <RejectedCard key={post.id} post={post} onReplace={onReplace} onOpen={onOpen} notify={notify} />)}</div>
      ) : <div className="empty"><h2>Niets afgekeurd</h2><p>Keur je iets af in de swipe, dan kun je hier zeggen wat er beter moet.</p></div>)}

      {segment === "approved" && (approved.length ? (
        <div className="grid">{approved.map((post) => (
          <button key={post.id} className="grid-card" onClick={() => onOpen(post.id)}>
            <img src={slideUrl(post, 0)} alt="" loading="lazy" />
            <span><b>{post.headline}</b><small>{format(parseISO(post.date), "EEE d MMM", { locale: nl })} · {post.time}</small></span>
          </button>
        ))}</div>
      ) : <div className="empty"><h2>Nog niets goedgekeurd</h2><p>Swipe naar rechts om posts in te plannen.</p></div>)}
    </section>
  );
}

function RejectedCard({ post, onReplace, onOpen, notify }: { post: Post; onReplace: (post: Post) => void; onOpen: (id: string) => void; notify: (text: string, error?: boolean) => void }) {
  const [feedback, setFeedback] = useState("");
  const [rewriteText, setRewriteText] = useState(true);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!feedback.trim()) return;
    setBusy(true);
    try {
      const data = await api<{ post: Post; textRevised: boolean }>(`/api/posts/${post.id}/revise`, { method: "POST", body: JSON.stringify({ feedback, rewriteText }) });
      onReplace(data.post);
      const imageFailed = data.post.image.status === "failed";
      notify(imageFailed ? `Terug in de swipe, maar geen nieuw beeld: ${data.post.image.error}` : data.textRevised ? "Tekst herschreven, nieuw beeld wordt gemaakt" : "Nieuw beeld wordt gemaakt", imageFailed);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Mislukt", true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="card rejected">
      <button className="rejected-thumb" onClick={() => onOpen(post.id)}><img src={slideUrl(post, 0)} alt="" loading="lazy" /></button>
      <div className="rejected-body">
        <span className="tag">{postLabel(post)}</span>
        <strong>{post.headline}</strong>
        {post.feedback && <small className="muted">Vorige feedback: {post.feedback}</small>}
        <textarea rows={2} placeholder="Wat moet er beter? Bijv. ‘rustiger beeld, geen laptop’ of ‘tips concreter maken’" value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={busy} />
        <div className="row">
          <label className="check"><input type="checkbox" checked={rewriteText} onChange={(e) => setRewriteText(e.target.checked)} /> Ook tekst herschrijven</label>
          <button className="btn primary small" disabled={busy || !feedback.trim()} onClick={submit}>{busy ? <RefreshCw size={14} className="spin" /> : <Send size={14} />} Opnieuw maken</button>
        </div>
      </div>
    </article>
  );
}

/* ---------- Detail ---------- */

function PostDrawer({ post, onClose, onPatch, onReplace, onDelete, notify }: {
  post: Post;
  onClose: () => void;
  onPatch: (post: Post, body: Record<string, unknown>) => Promise<Post | undefined>;
  onReplace: (post: Post) => void;
  onDelete: () => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    headline: post.headline, subline: post.subline, slides: post.slides, caption: post.caption,
    hashtags: post.hashtags.join(" "), date: post.date, time: post.time, template: post.template, scene: post.scene,
  }));
  const [imageNote, setImageNote] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify({
    headline: post.headline, subline: post.subline, slides: post.slides, caption: post.caption,
    hashtags: post.hashtags.join(" "), date: post.date, time: post.time, template: post.template, scene: post.scene,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    await onPatch(post, { ...draft, hashtags: draft.hashtags.split(/\s+/).filter(Boolean) });
    notify("Opgeslagen");
  };
  const newImage = async () => {
    setBusy(true);
    try {
      if (dirty) await save();
      const data = await api<{ post: Post }>(`/api/posts/${post.id}/image`, { method: "POST", body: JSON.stringify({ feedback: imageNote || undefined }) });
      onReplace(data.post);
      setImageNote("");
      notify(data.post.image.status === "failed" ? data.post.image.error ?? "Mislukt" : "Nieuw beeld wordt gemaakt", data.post.image.status === "failed");
    } finally {
      setBusy(false);
    }
  };
  const fullCaption = `${post.caption}\n\n${post.hashtags.join(" ")}`;
  const setSlide = (i: number, key: "title" | "body", value: string) => setDraft((d) => ({ ...d, slides: d.slides.map((s, j) => (j === i ? { ...s, [key]: value } : s)) }));

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className={`status s-${post.status}`}>{STATUS_LABEL[post.status]}</span>
            <h2>{post.headline}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="drawer-body">
          <div className="drawer-preview">
            <SlideViewer post={post} />
            {post.image.files.length > 1 && (
              <div className="variants">
                <span className="field-label">Kies foto</span>
                <div>{post.image.files.map((file, i) => (
                  <button key={file} className={i === post.image.selected ? "on" : ""} onClick={() => void onPatch(post, { selected: i })}><img src={mediaUrl(file)} alt={`Variant ${i + 1}`} /></button>
                ))}</div>
              </div>
            )}
            {post.image.status === "failed" && <div className="banner error small">{post.image.error}</div>}
            <PublishInfo post={post} />
            {post.image.provider === "kie" && post.image.fallbackReason && post.image.status !== "failed" && <div className="banner info small">Gemaakt via kie.ai (backup). {post.image.fallbackReason}</div>}
            <div className="field">
              <label className="field-label">Nieuw beeld</label>
              <div className="row">
                <input value={imageNote} onChange={(e) => setImageNote(e.target.value)} placeholder="Optioneel: ‘meer daglicht’, ‘zonder laptop’" />
                <button className="btn secondary small" disabled={busy || post.image.status === "generating"} onClick={newImage}><RefreshCw size={14} className={busy || post.image.status === "generating" ? "spin" : ""} /> Genereer</button>
              </div>
            </div>
            <div className="row wrap">
              {Array.from({ length: slideCount(post) }).map((_, i) => (
                <a key={i} className="btn ghost small" href={`${slideUrl(post, i)}&download=1`} download><Download size={13} /> {i === 0 ? "Cover" : i === slideCount(post) - 1 ? "Slot" : `Tip ${i}`}</a>
              ))}
            </div>
          </div>

          <div className="drawer-form">
            <div className="row">
              <div className="field grow"><label className="field-label">Datum</label><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
              <div className="field"><label className="field-label">Tijd</label><input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></div>
              <div className="field"><label className="field-label">Cover</label>
                <select value={draft.template} onChange={(e) => setDraft({ ...draft, template: e.target.value as Post["template"] })}><option value="photo">Foto</option><option value="card">Kaart</option></select>
              </div>
            </div>
            <div className="field"><label className="field-label">Kop</label><input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} maxLength={70} /></div>
            <div className="field"><label className="field-label">Ondertitel</label><input value={draft.subline} onChange={(e) => setDraft({ ...draft, subline: e.target.value })} maxLength={60} /></div>
            <span className="section-label">Tips</span>
            {draft.slides.map((slide, i) => (
              <div key={i} className="slide-edit">
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <div className="grow">
                  <input value={slide.title} onChange={(e) => setSlide(i, "title", e.target.value)} />
                  <textarea rows={2} value={slide.body} onChange={(e) => setSlide(i, "body", e.target.value)} />
                </div>
              </div>
            ))}
            <div className="field">
              <label className="field-label row between">Caption <button className="link" onClick={() => { void navigator.clipboard.writeText(fullCaption); notify("Caption + hashtags gekopieerd"); }}><Copy size={12} /> Kopieer</button></label>
              <textarea rows={6} value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
            </div>
            <div className="field"><label className="field-label">Hashtags</label><input value={draft.hashtags} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} /></div>
            <div className="field"><label className="field-label">Beeldscène (prompt)</label><textarea rows={3} value={draft.scene} onChange={(e) => setDraft({ ...draft, scene: e.target.value })} /></div>
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn danger small" onClick={() => { if (confirm("Deze post verwijderen?")) void onDelete(); }}><Trash2 size={14} /> Verwijder</button>
          <div className="row">
            {dirty && <button className="btn secondary" onClick={save}>Opslaan</button>}
            {post.status === "approved" && <button className="btn secondary" disabled={busy} onClick={async () => {
              if (!confirm("Deze post nu direct op Instagram en Facebook zetten?")) return;
              setBusy(true);
              try {
                const data = await api<{ post: Post }>(`/api/posts/${post.id}/publish`, { method: "POST" });
                onReplace(data.post);
                notify(data.post.status === "posted" ? "Gepost" : data.post.publish?.error ?? "Deels gelukt", data.post.status !== "posted");
              } catch (error) {
                notify(error instanceof Error ? error.message : "Posten mislukt", true);
              } finally {
                setBusy(false);
              }
            }}><Send size={14} /> Nu posten</button>}
            {post.status === "approved" && <button className="btn secondary" onClick={() => void onPatch(post, { status: "posted" })}>Markeer als gepost</button>}
            {post.status !== "approved" && post.status !== "posted" && <button className="btn primary" onClick={async () => { if (dirty) await save(); await onPatch(post, { status: "approved" }); notify("Goedgekeurd"); }}><Check size={15} /> Goedkeuren</button>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function PublishInfo({ post }: { post: Post }) {
  const publish = post.publish;
  if (post.status === "approved" && !publish?.error) return <div className="banner info small">Ingepland voor {format(parseISO(post.date), "EEEE d MMMM", { locale: nl })} om {post.time}.</div>;
  if (!publish) return null;
  return <>
    {(publish.instagram || publish.facebook) && <div className="banner info small">Gepost op {[publish.instagram && "Instagram", publish.facebook && "Facebook"].filter(Boolean).join(" en ")}.</div>}
    {publish.error && <div className="banner error small">Posten mislukt ({publish.attempts ?? 1}×): {publish.error}</div>}
  </>;
}

/* ---------- Genereren ---------- */

const WEEKDAYS = [["ma", 1], ["di", 2], ["wo", 3], ["do", 4], ["vr", 5], ["za", 6], ["zo", 7]] as const;

function GenerateModal({ posts, providers, onClose, onDone, notify }: { posts: Post[]; providers: Providers | null; onClose: () => void; onDone: (count: number, startDate: string) => void; notify: (text: string, error?: boolean) => void }) {
  const lastDate = posts.length ? posts[posts.length - 1].date : null;
  const [startDate, setStartDate] = useState(() => format(lastDate && parseISO(lastDate) > new Date() ? addDays(parseISO(lastDate), 1) : nextMonday(new Date()), "yyyy-MM-dd"));
  const [weeks, setWeeks] = useState(2);
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("12:00");
  const [busy, setBusy] = useState(false);
  const total = weeks * weekdays.length;

  async function submit() {
    setBusy(true);
    try {
      const data = await api<{ created: number }>("/api/posts/generate", { method: "POST", body: JSON.stringify({ startDate, weeks, weekdays, time }) });
      onDone(data.created, startDate);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Genereren mislukt", true);
      setBusy(false);
    }
  }

  return (
    <div className="overlay center" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div><span className="section-label">Nieuwe posts</span><h2>Vul je kalender</h2></div>
          {!busy && <button className="icon-btn" onClick={onClose}><X size={16} /></button>}
        </div>
        <div className="row">
          <div className="field grow"><label className="field-label">Vanaf</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="field"><label className="field-label">Periode</label>
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>{[[1, "1 week"], [2, "2 weken"], [4, "1 maand"], [8, "2 maanden"], [13, "3 maanden"]].map(([w, label]) => <option key={w} value={w}>{label}</option>)}</select>
          </div>
          <div className="field"><label className="field-label">Tijd</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <div className="field">
          <label className="field-label">Postdagen</label>
          <div className="chips">{WEEKDAYS.map(([label, day]) => (
            <button key={day} className={weekdays.includes(day) ? "on" : ""} onClick={() => setWeekdays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort()))}>{label}</button>
          ))}</div>
        </div>
        <div className="summary">
          <Plus size={14} /> <span><b>{total} posts</b> (≈ {total} GenAI-credits, 1 per post met 4 fotovarianten) · tekst via {providers?.text === "kie" ? "Gemini Flash (kie.ai)" : "de ingebouwde tipbank"} · beelden via {providers?.image.genai ? "GenAI Pro (Nano Banana Pro)" : providers?.image.kie ? "kie.ai" : "geen provider — eerst een API-sleutel toevoegen"}</span>
        </div>
        <p className="muted small-text">De posts worden één voor één gemaakt (max 6 beelden tegelijk), zodat je niet tegen limieten aanloopt. Dagen waarop al een post staat worden overgeslagen. Maximaal 1 op de 8 posts noemt SequenceFlow.</p>
        <button className="btn primary wide" disabled={busy || !total} onClick={submit}>
          {busy ? <><RefreshCw size={15} className="spin" /> In de wachtrij zetten…</> : <><Sparkles size={15} /> Zet {total} posts in de wachtrij</>}
        </button>
      </div>
    </div>
  );
}

/* ---------- Kennisbank ---------- */

function BrandView() {
  const totalWeight = PILLARS.reduce((sum, p) => sum + p.weight, 0);
  return (
    <section className="brand-view">
      <div className="section-head"><div><span className="section-label">Kennisbank</span><h1>Wat we posten, en waarom</h1></div></div>
      <div className="brand-grid">
        <div className="card">
          <span className="section-label">Missie</span>
          <p className="lead">{BRAND.mission}</p>
          <p className="muted">{BRAND.stance}</p>
        </div>
        <div className="card">
          <span className="section-label">Doelgroep</span>
          <p className="lead">{AUDIENCE.who}</p>
          <ul>{AUDIENCE.pains.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="card">
          <span className="section-label">Stem</span>
          <p className="lead">{VOICE.personality}</p>
          <ul>{VOICE.rules.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="muted small-text">Vermijden: {VOICE.avoid.join(", ")}</p>
        </div>
      </div>
      <span className="section-label">Contentpijlers · max {Math.round(PROMO_RATIO * 100)}% over ons product</span>
      <div className="pillars">
        {PILLARS.map((p) => (
          <div key={p.id} className={`card pillar ${p.promo ? "promo" : ""}`}>
            <div className="row between"><strong>{p.name}</strong><span className="tag">{Math.round((p.weight / totalWeight) * 100)}%</span></div>
            <p className="muted">{p.goal}</p>
            <div className="chips static">{p.angles.map((a) => <span key={a}>{a}</span>)}</div>
          </div>
        ))}
      </div>
      <span className="section-label">Formats · de vorm van een post, de AI vult hem creatief in</span>
      <div className="pillars">
        {FORMATS.map((f) => (
          <div key={f.id} className="card pillar">
            <div className="row between"><strong>{f.name}</strong>{f.needsFacts && <span className="tag">alleen met feiten</span>}</div>
            <p className="muted">{f.goal}</p>
            <p className="muted small-text">{f.structure}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <span className="section-label">Actuele feiten · de enige bron voor regels en platformnieuws</span>
        <ul>{NEWS.map((n) => <li key={n.id}><strong>{n.title}</strong> <span className="muted small-text">({n.kind}{n.from || n.until ? `, ${n.from ?? "…"} t/m ${n.until ?? "…"}` : ""})</span><br /><span className="muted">{n.fact}</span></li>)}</ul>
      </div>
      <div className="card">
        <span className="section-label">Beeldtaal</span>
        <p>{VISUAL_STYLE.look}</p>
        <ul>{VISUAL_STYLE.rules.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
      <p className="muted small-text">Aanpassen? De kennisbank staat in <code>lib/contentCalendar/brand.ts</code>.</p>
    </section>
  );
}
