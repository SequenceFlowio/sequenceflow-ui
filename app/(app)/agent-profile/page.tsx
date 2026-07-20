"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";

type ProfileFact = {
  id: string;
  kind: "fact" | "house_rule" | "exemplar";
  intent: string | null;
  content: string;
  confidence: number | null;
  status: "proposed" | "approved" | "rejected";
  origin: "mining" | "learning" | "manual";
};

type AgentProfile = {
  version: number;
  status: "draft" | "active";
  identity: {
    greeting?: string;
    signoff?: string;
    pronoun?: string;
    company_descriptor?: string;
  } | null;
  voice_notes: string | null;
  stats: { exchanges?: number } | null;
};

type MiningJob = {
  id: string;
  status: "queued" | "running" | "distilling" | "done" | "failed";
  phase: string | null;
  sent_scanned: number;
  exchanges_mined: number;
  error: string | null;
};

type LearningEvent = {
  id: string;
  decision_id: string;
  conversation_id: string | null;
  normalized_ai: string;
  normalized_human: string;
  normalized_diff: { added?: string[]; removed?: string[] } | null;
  edit_distance: number;
  classification: "fact" | "policy" | "tone" | "structure" | "other";
  candidate_rule: string | null;
  confidence: number;
  status: "processing" | "processed" | "proposed" | "ignored" | "failed";
  processing_ms: number;
  processed_at: string;
};

type LearningMetrics = {
  reviewedDecisions: number;
  corrections: number;
  correctionRate: number;
  medianEditDistance: number;
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  overflow: "hidden",
};

const cardHeaderStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--border)",
  display: "grid",
  gap: 4,
};

export default function AgentProfilePage() {
  const { t } = useTranslation();
  const ta = t.agentProfile;

  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [facts, setFacts] = useState<ProfileFact[]>([]);
  const [job, setJob] = useState<MiningJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [activating, setActivating] = useState(false);
  const [startingMine, setStartingMine] = useState(false);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics>({ reviewedDecisions: 0, corrections: 0, correctionRate: 0, medianEditDistance: 0 });
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const jobStatusRef = useRef<string | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const [profileRes, jobRes] = await Promise.all([
        fetch("/api/agent-profile", { cache: "no-store" }),
        fetch("/api/onboarding/mine", { cache: "no-store" }),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.profile ?? null);
        setFacts((data.facts ?? []) as ProfileFact[]);
        setLearningEvents((data.learning?.events ?? []) as LearningEvent[]);
        setLearningMetrics(data.learning?.metrics ?? { reviewedDecisions: 0, corrections: 0, correctionRate: 0, medianEditDistance: 0 });
      } else if (!silent) {
        setError(ta.loadError);
      }
      if (jobRes.ok) {
        const data = await jobRes.json();
        setJob((data.job ?? null) as MiningJob | null);
      }
    } catch {
      if (!silent) setError(ta.loadError);
    } finally {
      setLoading(false);
    }
  }, [ta.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while a mining run is in flight; reload the full profile when it lands.
  useEffect(() => {
    const active = job && ["queued", "running", "distilling"].includes(job.status);
    jobStatusRef.current = job?.status ?? null;
    if (!active) return;
    const iv = setInterval(async () => {
      const res = await fetch("/api/onboarding/mine", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      const next = (data.job ?? null) as MiningJob | null;
      setJob(next);
      if (next && next.status === "done" && jobStatusRef.current !== "done") {
        load(true);
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [job, load]);

  async function startMining() {
    setStartingMine(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthsBack: 12 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? ta.actionError);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : ta.actionError);
    } finally {
      setStartingMine(false);
    }
  }

  async function updateFact(id: string, status: "approved" | "rejected") {
    setBusyIds((prev) => new Set(prev).add(id));
    const previous = facts;
    setFacts((prev) =>
      status === "rejected"
        ? prev.filter((fact) => fact.id !== id)
        : prev.map((fact) => (fact.id === id ? { ...fact, status } : fact)),
    );
    try {
      const res = await fetch(`/api/agent-profile/facts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFacts(previous);
      setError(ta.actionError);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function saveFactContent(id: string) {
    const content = editContent.trim();
    if (!content) return;
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/agent-profile/facts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      setFacts((prev) => prev.map((fact) => fact.id === id ? { ...fact, content } : fact));
      setEditingFactId(null);
      setEditContent("");
    } catch {
      setError(ta.actionError);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function toggleProfileStatus() {
    if (!profile) return;
    const nextStatus = profile.status === "active" ? "draft" : "active";
    setActivating(true);
    try {
      const res = await fetch("/api/agent-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      setProfile({ ...profile, status: nextStatus });
    } catch {
      setError(ta.actionError);
    } finally {
      setActivating(false);
    }
  }

  const houseRules = facts.filter((fact) => fact.kind === "house_rule");
  const businessFacts = facts.filter((fact) => fact.kind === "fact");
  const exemplars = facts.filter((fact) => fact.kind === "exemplar");
  const proposedCount = facts.filter((fact) => fact.status === "proposed").length;
  const miningActive = job && ["queued", "running", "distilling"].includes(job.status);

  function FactRow({ fact }: { fact: ProfileFact }) {
    const busy = busyIds.has(fact.id);
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gap: 12,
          alignItems: "start",
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${fact.status === "approved" ? "rgba(199,245,111,0.35)" : "var(--border)"}`,
          background: fact.status === "approved" ? "rgba(199,245,111,0.07)" : "var(--bg)",
        }}
      >
        <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
          {editingFactId === fact.id ? (
            <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} rows={4} autoFocus
              style={{ width: "100%", resize: "vertical", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", padding: 10, font: "inherit", lineHeight: 1.6 }} />
          ) : (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}>{fact.content}</p>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                borderRadius: 999,
                padding: "3px 9px",
                fontSize: 10,
                fontWeight: 800,
                background: fact.status === "approved" ? "rgba(199,245,111,0.2)" : "rgba(251,191,36,0.14)",
                color: fact.status === "approved" ? "var(--tone-success-strong)" : "#a16207",
              }}
            >
              {fact.status === "approved" ? ta.approvedBadge : ta.proposedBadge}
            </span>
            {fact.intent ? (
              <span style={{ borderRadius: 999, padding: "3px 9px", fontSize: 10, fontWeight: 700, border: "1px solid var(--border)", color: "var(--muted)" }}>
                {fact.intent.replace(/_/g, " ")}
              </span>
            ) : null}
            {fact.origin === "learning" ? (
              <span style={{ borderRadius: 999, padding: "3px 9px", fontSize: 10, fontWeight: 700, background: "rgba(96,165,250,0.12)", color: "#2563eb" }}>
                {ta.fromLearning}
              </span>
            ) : null}
            {fact.confidence != null ? (
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{Math.round(fact.confidence * 100)}%</span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {editingFactId === fact.id ? (
            <>
              <button type="button" disabled={busy} onClick={() => saveFactContent(fact.id)} className="btn-secondary">{ta.saveEdit}</button>
              <button type="button" disabled={busy} onClick={() => { setEditingFactId(null); setEditContent(""); }} className="btn-secondary">{ta.cancelEdit}</button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => { setEditingFactId(fact.id); setEditContent(fact.content); }} className="btn-secondary">{ta.edit}</button>
          )}
          {editingFactId !== fact.id && fact.status !== "approved" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateFact(fact.id, "approved")}
              style={{ minHeight: 34, padding: "0 12px", borderRadius: 10, border: "none", background: "#C7F56F", color: "#0f1a00", fontSize: 12, fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {ta.approve}
            </button>
          )}
          {editingFactId !== fact.id && <button
            type="button"
            disabled={busy}
            onClick={() => updateFact(fact.id, "rejected")}
            style={{ minHeight: 34, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(248,113,113,0.3)", background: "transparent", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}
          >
            {ta.reject}
          </button>}
        </div>
      </div>
    );
  }

  function Section({ title, description, items }: { title: string; description?: string; items: ProfileFact[] }) {
    if (items.length === 0) return null;
    return (
      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{title}</p>
          {description ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{description}</p>
          ) : null}
        </div>
        <div style={{ padding: 16, display: "grid", gap: 10 }}>
          {items.map((fact) => (
            <FactRow key={fact.id} fact={fact} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px 64px", display: "grid", gap: 22 }}>
      <header>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
          ReplyOS
        </p>
        <h1 style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
          {ta.title}
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.7, color: "var(--muted)", maxWidth: 680 }}>
          {ta.subtitle}
        </p>
      </header>

      {error && (
        <div style={{ borderRadius: 14, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "#f87171", padding: "12px 14px", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Mining status / start ── */}
      <section style={{ ...cardStyle, padding: 18, display: "grid", gap: 12 }}>
        {miningActive ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              aria-hidden
              style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(199,245,111,0.25)", borderTopColor: "#C7F56F", animation: "agent-profile-spin 0.8s linear infinite", flexShrink: 0 }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{ta.miningRunning}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                {job?.phase ?? `${job?.sent_scanned ?? 0} mails…`}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 560 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                {job?.status === "failed" ? ta.miningFailed : job?.status === "done" ? ta.miningDone : ta.startMining}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                {job?.status === "failed"
                  ? job.error ?? ta.actionError
                  : job?.status === "done"
                    ? `${job.exchanges_mined} ${ta.exchangesLabel} · ${proposedCount} ${ta.factsProposedLabel}`
                    : ta.startMiningHint}
              </p>
            </div>
            <button
              type="button"
              onClick={startMining}
              disabled={startingMine}
              style={{ minHeight: 44, padding: "0 18px", borderRadius: 12, border: "none", background: "#C7F56F", color: "#0f1a00", fontSize: 13, fontWeight: 800, cursor: startingMine ? "wait" : "pointer", opacity: startingMine ? 0.6 : 1 }}
            >
              {job?.status === "failed" ? ta.miningRetry : ta.startMining}
            </button>
          </div>
        )}
      </section>

      {loading ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{t.common.loading}</p>
      ) : !profile && !miningActive ? (
        <section style={{ ...cardStyle, padding: 28, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{ta.emptyTitle}</p>
          <p style={{ margin: "8px auto 0", fontSize: 13, color: "var(--muted)", maxWidth: 460, lineHeight: 1.65 }}>{ta.emptyDesc}</p>
        </section>
      ) : profile ? (
        <>
          {/* ── Profile status + identity ── */}
          <section style={cardStyle}>
            <div style={{ ...cardHeaderStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{ta.sectionIdentity}</p>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 10,
                    fontWeight: 800,
                    background: profile.status === "active" ? "rgba(199,245,111,0.2)" : "rgba(251,191,36,0.14)",
                    color: profile.status === "active" ? "var(--tone-success-strong)" : "#a16207",
                  }}
                >
                  {profile.status === "active" ? ta.profileActive : ta.profileDraft}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleProfileStatus}
                disabled={activating}
                style={{
                  minHeight: 38,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: profile.status === "active" ? "1px solid var(--border)" : "none",
                  background: profile.status === "active" ? "transparent" : "#C7F56F",
                  color: profile.status === "active" ? "var(--muted)" : "#0f1a00",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: activating ? "wait" : "pointer",
                  opacity: activating ? 0.6 : 1,
                }}
              >
                {profile.status === "active" ? ta.deactivateBtn : ta.activateBtn}
              </button>
            </div>
            <div style={{ padding: 18, display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {[
                  { label: ta.greeting, value: profile.identity?.greeting },
                  { label: ta.signoff, value: profile.identity?.signoff },
                  { label: ta.pronoun, value: profile.identity?.pronoun },
                  { label: ta.companyDescriptor, value: profile.identity?.company_descriptor },
                ].map((item) => (
                  <div key={item.label} style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg)", padding: "12px 14px" }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)" }}>
                      {item.label}
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                      {item.value || "—"}
                    </p>
                  </div>
                ))}
              </div>
              {profile.voice_notes ? (
                <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg)", padding: "12px 14px" }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)" }}>
                    {ta.voiceNotes}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text)", lineHeight: 1.65 }}>{profile.voice_notes}</p>
                </div>
              ) : null}
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{ta.activateHint}</p>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{ta.learningTitle}</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{ta.learningDesc}</p>
            </div>
            <div style={{ padding: 18, display: "grid", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                {[
                  { label: ta.learningCorrectionRate, value: `${Math.round(learningMetrics.correctionRate * 100)}%` },
                  { label: ta.learningMedianDistance, value: `${Math.round(learningMetrics.medianEditDistance * 100)}%` },
                  { label: ta.learningReviewed, value: String(learningMetrics.reviewedDecisions) },
                ].map((metric) => (
                  <div key={metric.label} style={{ padding: "12px 14px", borderLeft: "2px solid #C7F56F", background: "var(--bg)" }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "var(--muted)" }}>{metric.label}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{metric.value}</p>
                  </div>
                ))}
              </div>
              {learningEvents.length ? (
                <div style={{ display: "grid", gap: 0 }}>
                  {learningEvents.slice(0, 12).map((event) => (
                    <details key={event.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                      <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: "var(--text)" }}>
                        <span style={{ fontWeight: 750 }}>{event.classification} · {Math.round(Number(event.edit_distance) * 100)}% {ta.learningChanged}</span>
                        <span style={{ color: "var(--muted)" }}>{new Date(event.processed_at).toLocaleDateString()}</span>
                      </summary>
                      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                        <p style={{ margin: 0, fontSize: 10, color: "var(--muted)" }}>
                          {ta.learningSource}: {event.conversation_id ? <Link href={`/inbox/${event.conversation_id}`} style={{ color: "inherit", textDecoration: "underline" }}>{event.decision_id}</Link> : event.decision_id} · {event.processing_ms} ms
                        </p>
                        <p style={{ margin: 0, fontSize: 10, color: "var(--muted)" }}>{ta.learningStatus}: {event.status} · {ta.learningConfidence}: {Math.round(event.confidence * 100)}%</p>
                        <div><p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>{ta.learningAiDraft}</p><p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>{event.normalized_ai}</p></div>
                        <div><p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>{ta.learningHumanDraft}</p><p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--text)" }}>{event.normalized_human}</p></div>
                        {(event.normalized_diff?.removed?.length || event.normalized_diff?.added?.length) ? <div style={{ display: "grid", gap: 6 }}>
                          {event.normalized_diff?.removed?.length ? <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: "#dc2626" }}><strong>{ta.learningRemoved}:</strong> {event.normalized_diff.removed.join(" ")}</p> : null}
                          {event.normalized_diff?.added?.length ? <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: "var(--tone-success-strong)" }}><strong>{ta.learningAdded}:</strong> {event.normalized_diff.added.join(" ")}</p> : null}
                        </div> : null}
                        {event.candidate_rule ? <p style={{ margin: 0, fontSize: 12, color: "var(--tone-success-strong)" }}>{ta.learningRule}: {event.candidate_rule}</p> : null}
                      </div>
                    </details>
                  ))}
                </div>
              ) : <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{ta.learningEmpty}</p>}
            </div>
          </section>

          <Section title={ta.sectionHouseRules} description={ta.sectionHouseRulesDesc} items={houseRules} />
          <Section title={ta.sectionFacts} description={ta.sectionFactsDesc} items={businessFacts} />
          <Section title={ta.sectionExemplars} description={ta.sectionExemplarsDesc} items={exemplars} />
        </>
      ) : null}

      <style>{`
        @keyframes agent-profile-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
