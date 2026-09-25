"use client";
import { appFetch } from "@/lib/shopify/client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MailSearch,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "@/components/shopify/AppLink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SequenceMark } from "@/components/marketing/SequenceMark";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { supportLabel } from "@/lib/support/labels";

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
  updated_at?: string;
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
  proposed_fact_id: string | null;
  conversation_id: string | null;
  normalized_ai: string;
  normalized_human: string;
  normalized_diff: { added?: string[]; removed?: string[] } | null;
  edit_distance: number;
  classification: "fact" | "policy" | "tone" | "structure" | "other";
  candidate_rule: string | null;
  confidence: number;
  status: "processing" | "processed" | "proposed" | "ignored" | "failed";
  processed_at: string;
};

type LearningMetrics = {
  reviewedDecisions: number;
  corrections: number;
  correctionRate: number;
  medianEditDistance: number;
};

const EMPTY_METRICS: LearningMetrics = {
  reviewedDecisions: 0,
  corrections: 0,
  correctionRate: 0,
  medianEditDistance: 0,
};

function AgentProfileStyles() {
  return <style>{`
    .agent-profile-page{width:min(100%,1080px);margin:0 auto;padding:40px 24px 72px;color:var(--sf-text)}
    .agent-profile-head{margin-bottom:22px}
    .agent-profile-head h1{margin:0;font-size:30px;font-weight:500;line-height:1.15;letter-spacing:-.02em}
    .agent-profile-head p{max-width:680px;margin:7px 0 0;color:var(--sf-text-muted);font-size:14px;line-height:1.6}
    .agent-profile-stack{display:grid;gap:18px}
    .agent-profile-section{min-width:0;border:1px solid var(--sf-border);border-radius:20px;background:var(--sf-surface);overflow:hidden}
    .agent-profile-section[id="leervoorstellen"]{scroll-margin-top:24px}
    .agent-profile-section-head{display:flex;align-items:center;gap:14px;padding:18px 20px}
    .agent-profile-section-title{min-width:0}
    .agent-profile-section-title h2{display:flex;align-items:center;gap:8px;margin:0;font-size:16px;font-weight:500;letter-spacing:-.01em}
    .agent-profile-section-title p{margin:4px 0 0;color:var(--sf-text-muted);font-size:13px;line-height:1.5}
    .agent-profile-count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:var(--sf-green);color:#10180a;font-size:11px;font-weight:600}
    .agent-profile-section-body{padding:0 20px 20px}
    .agent-profile-pill{display:inline-flex;align-items:center;min-height:24px;padding:0 10px;border:1px solid rgba(199,245,111,.28);border-radius:999px;background:rgba(199,245,111,.1);color:var(--sf-green);font-size:11px;font-weight:600;white-space:nowrap}
    .agent-profile-notice{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--sf-border);border-radius:14px;background:var(--sf-surface-2);color:var(--sf-text-muted);font-size:13px;line-height:1.5}
    .agent-profile-notice.success{border-color:rgba(199,245,111,.28);background:rgba(199,245,111,.08);color:var(--tone-success)}
    .agent-profile-notice.error{border-color:rgba(248,113,113,.32);background:rgba(248,113,113,.1);color:var(--tone-danger)}
    .agent-profile-notice>svg{flex:none;margin-top:2px}
    .agent-profile-notice>div{flex:1}
    .agent-profile-notice strong{display:block;font-weight:600}
    .agent-profile-notice p{margin:2px 0 0;color:var(--sf-text)}
    .agent-profile-notice button{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:0;border:0;background:transparent;color:inherit;font:600 12px inherit;cursor:pointer}
    .agent-profile-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .agent-profile-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:0 14px;border:1px solid var(--sf-border);border-radius:10px;background:var(--sf-surface);color:var(--sf-text);font:600 12px inherit;cursor:pointer}
    .agent-profile-button:hover{background:var(--sf-surface-2)}
    .agent-profile-button.primary{border-color:var(--sf-green);background:var(--sf-green);color:#10180a}
    .agent-profile-button.primary:hover{filter:brightness(1.06)}
    .agent-profile-button.ghost{border-color:transparent;background:transparent;color:var(--sf-text-muted)}
    .agent-profile-button.ghost:hover{color:var(--tone-danger)}
    .agent-profile-button.danger:hover{border-color:rgba(248,113,113,.32);color:var(--tone-danger)}
    .agent-profile-button.icon{width:32px;min-height:32px;padding:0}
    .agent-profile-button:disabled{cursor:not-allowed;opacity:.5}
    .agent-profile-link{display:inline-flex;align-items:center;gap:5px;width:max-content;color:var(--sf-text-muted);font-size:12px;font-weight:600;text-decoration:none}
    .agent-profile-link:hover{color:var(--sf-green)}
    .agent-profile-muted{margin:0;color:var(--sf-text-muted);font-size:13px;line-height:1.55}
    .agent-profile-proposals{display:grid;gap:12px;padding:0 20px 20px}
    .agent-profile-proposal{display:grid;gap:12px;padding:16px;border:1px solid var(--sf-border);border-radius:16px;background:var(--sf-surface-2)}
    .agent-profile-proposal-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--sf-text-muted);font-size:12px}
    .agent-profile-change{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;line-height:1.55;overflow-wrap:anywhere}
    .agent-profile-change s{color:var(--sf-text-muted)}
    .agent-profile-change svg{flex:none;color:var(--sf-text-muted)}
    .agent-profile-change strong{color:var(--sf-green);font-weight:500}
    .agent-profile-proposal-rule p{margin:0;color:var(--sf-text);font-size:14px;line-height:1.6;white-space:pre-wrap}
    .agent-profile-proposal-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .agent-profile-page textarea{width:100%;min-height:92px;resize:vertical;border:1px solid var(--sf-border);border-radius:10px;background:var(--sf-surface);color:var(--sf-text);padding:10px 12px;font:13px/1.6 inherit;outline:none}
    .agent-profile-page textarea:focus{border-color:var(--sf-green);box-shadow:0 0 0 3px rgba(199,245,111,.14)}
    .agent-profile-rules-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .agent-profile-rule-section{min-width:0;border:1px solid var(--sf-border);border-radius:16px;overflow:hidden}
    .agent-profile-rule-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--sf-border)}
    .agent-profile-rule-head strong{font-size:13px;font-weight:600}
    .agent-profile-rule-head span{color:var(--sf-text-muted);font-size:12px}
    .agent-profile-rule{display:grid;gap:8px;padding:12px 14px;border-bottom:1px solid var(--sf-border)}
    .agent-profile-rule:last-child{border-bottom:0}
    .agent-profile-rule>p{margin:0;color:var(--sf-text);font-size:13px;line-height:1.55;white-space:pre-wrap}
    .agent-profile-rule-actions{display:flex;justify-content:flex-end;gap:6px}
    .agent-profile-rule-empty{padding:18px 14px;color:var(--sf-text-muted);font-size:12px;line-height:1.5;text-align:center}
    .agent-profile-identity{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:0;border-top:1px solid var(--sf-border)}
    .agent-profile-identity-item{min-width:0;padding:14px 20px;border-right:1px solid var(--sf-border)}
    .agent-profile-identity-item:nth-child(4){border-right:0}
    .agent-profile-identity-item:last-child{grid-column:1/-1;border-right:0;border-top:1px solid var(--sf-border)}
    .agent-profile-identity-item dt{color:var(--sf-text-muted);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
    .agent-profile-identity-item dd{margin:5px 0 0;color:var(--sf-text);font-size:13px;line-height:1.55;white-space:pre-wrap}
    .agent-profile-mining{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 20px;border-top:1px solid var(--sf-border)}
    .agent-profile-mining-copy{display:flex;align-items:flex-start;gap:10px;min-width:0}
    .agent-profile-mining-copy>svg{flex:none;margin-top:2px;color:var(--sf-text-muted)}
    .agent-profile-mining-copy strong{display:block;font-size:13px;font-weight:600}
    .agent-profile-mining-copy p{margin:3px 0 0;color:var(--sf-text-muted);font-size:12px;line-height:1.5}
    .agent-profile-history>summary{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 20px;list-style:none;cursor:pointer}
    .agent-profile-history>summary::-webkit-details-marker{display:none}
    .agent-profile-history>summary>svg{flex:none;color:var(--sf-text-muted);transition:transform .2s}
    .agent-profile-history[open]>summary>svg{transform:rotate(180deg)}
    .agent-profile-events{border:1px solid var(--sf-border);border-radius:14px;overflow:hidden}
    .agent-profile-event{border-bottom:1px solid var(--sf-border)}
    .agent-profile-event:last-child{border-bottom:0}
    .agent-profile-event summary{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:12px 14px;list-style:none;cursor:pointer}
    .agent-profile-event summary::-webkit-details-marker{display:none}
    .agent-profile-event-title strong{display:block;font-size:13px;font-weight:600}
    .agent-profile-event-title span{display:block;margin-top:2px;color:var(--sf-text-muted);font-size:12px}
    .agent-profile-event-date{color:var(--sf-text-muted);font-size:12px;white-space:nowrap}
    .agent-profile-event summary>svg{color:var(--sf-text-muted);transition:transform .2s}
    .agent-profile-event[open] summary>svg{transform:rotate(180deg)}
    .agent-profile-event-body{display:grid;gap:12px;padding:0 14px 14px}
    .agent-profile-comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .agent-profile-comparison>div{padding:12px;border:1px solid var(--sf-border);border-radius:12px;background:var(--sf-surface-2)}
    .agent-profile-comparison span{display:block;color:var(--sf-text-muted);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
    .agent-profile-comparison p{margin:6px 0 0;color:var(--sf-text);font-size:12px;line-height:1.55;white-space:pre-wrap}
    .agent-profile-empty{display:grid;place-items:center;align-content:center;gap:10px;min-height:220px;padding:28px;text-align:center}
    .agent-profile-empty strong{font-size:16px;font-weight:500}
    .agent-profile-empty p{max-width:460px;margin:0;color:var(--sf-text-muted);font-size:13px;line-height:1.55}
    .agent-profile-skeleton{height:160px;border-radius:20px;background:linear-gradient(90deg,var(--sf-surface) 20%,var(--sf-surface-2) 50%,var(--sf-surface) 80%);background-size:220% 100%;animation:agentProfileSkeleton 1.2s infinite}
    .agent-profile-spin{animation:agentProfileSpin .8s linear infinite}
    @keyframes agentProfileSpin{to{transform:rotate(360deg)}}@keyframes agentProfileSkeleton{to{background-position:-20% 0}}
    .agent-profile-page svg{display:block}
    @media(max-width:900px){.agent-profile-identity{grid-template-columns:repeat(2,minmax(0,1fr))}.agent-profile-identity-item:nth-child(2){border-right:0}.agent-profile-identity-item:nth-child(-n+2){border-bottom:1px solid var(--sf-border)}.agent-profile-rules-grid{grid-template-columns:1fr}}
    @media(max-width:640px){.agent-profile-page{padding:28px 16px 56px}.agent-profile-mining{align-items:flex-start;flex-direction:column}.agent-profile-identity{grid-template-columns:1fr}.agent-profile-identity-item{border-right:0!important;border-bottom:1px solid var(--sf-border)}.agent-profile-identity-item:last-child{border-bottom:0}.agent-profile-comparison{grid-template-columns:1fr}.agent-profile-event summary{grid-template-columns:minmax(0,1fr) auto}.agent-profile-event-date{display:none}.agent-profile-section-head{align-items:flex-start}}
  `}</style>;
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default function AgentProfilePage() {
  const { t, language } = useTranslation();
  const ta = t.agentProfile;
  const nl = language === "nl";
  const locale = nl ? "nl-NL" : "en-US";
  const copy = nl ? {
    reviewTitle: "Ter beoordeling",
    reviewDesc: "Na een aangepast antwoord stelt Support One een vaste afspraak voor. Keur je hem goed, dan gebruikt Support One hem direct.",
    pending: "Ter beoordeling",
    fromCorrection: "Zo werd het antwoord aangepast",
    sourceCorrection: "Bekijk het antwoord",
    noProposals: "Geen voorstellen open. Na een aangepast antwoord kan hier een nieuwe afspraak verschijnen.",
    activeKnowledge: "Afspraken",
    activeKnowledgeDesc: "Deze afspraken gebruikt Support One in elk nieuw antwoord.",
    identityDesc: "Hoe Support One begint, afsluit en klinkt.",
    historyReady: "Eerdere antwoorden gelezen",
    historyRunning: "Eerdere antwoorden worden gelezen",
    historyInitial: "Leer van je eerdere antwoorden",
    historyInitialDetail: "Support One leest je Verzonden-map en doet voorstellen. Er wordt niets actief zonder jouw akkoord.",
    historyDoneDetail: (exchanges: number, proposed: number) => `${exchanges} gesprekken gelezen · ${proposed} voorstellen open`,
    runAgain: "Opnieuw lezen",
    start: "Eerdere antwoorden lezen",
    readOnly: "Alleen beheerders kunnen afspraken aanpassen. Je kunt ze wel bekijken.",
    successApproved: "Goedgekeurd. Support One gebruikt deze afspraak vanaf nu.",
    successRejected: "Voorstel afgewezen.",
    successRemoved: "Afspraak verwijderd.",
    successSaved: "Wijziging opgeslagen.",
    retry: "Opnieuw proberen",
    emptyRules: "Nog niets in deze categorie.",
    sourceMailbox: "Uit eerdere antwoorden",
    sourceLearning: "Uit een correctie",
    sourceManual: "Zelf toegevoegd",
    ruleTypes: { house_rule: "Huisregels", fact: "Bedrijfsfeiten", exemplar: "Voorbeeldantwoorden" },
    corrections: "Correcties",
    correctionsSummary: (reviewed: number, corrections: number) => `${reviewed} verzonden antwoorden bekeken · ${corrections} inhoudelijk aangepast`,
    noLearning: "Nog geen correcties. Die verschijnen zodra een aangepast antwoord is verzonden.",
    sourceReply: "Bekijk het antwoord",
    proposedLesson: "Voorgestelde afspraak",
    approvedLesson: "Goedgekeurde afspraak",
    classification: { fact: "Bedrijfsfeit", policy: "Beleid", tone: "Toon", structure: "Opbouw", other: "Overig" },
    eventStatus: { processing: "Wordt verwerkt", processed: "Verwerkt", proposed: "Voorstel gemaakt", ignored: "Niet herbruikbaar", failed: "Verwerking mislukt" },
    approved: "Goedgekeurd",
    editRule: "Aanpassen",
    rejectRule: "Afwijzen",
    removeRule: "Afspraak verwijderen",
  } : {
    reviewTitle: "Needs review",
    reviewDesc: "After an edited reply, Support One proposes a fixed rule. Approve it and Support One uses it right away.",
    pending: "Needs review",
    fromCorrection: "How the reply was edited",
    sourceCorrection: "View the reply",
    noProposals: "No proposals pending. After an edited reply, a new rule may appear here.",
    activeKnowledge: "Rules",
    activeKnowledgeDesc: "Support One uses these rules in every new reply.",
    identityDesc: "How Support One opens, closes and sounds.",
    historyReady: "Earlier replies read",
    historyRunning: "Reading earlier replies",
    historyInitial: "Learn from your earlier replies",
    historyInitialDetail: "Support One reads your Sent folder and makes proposals. Nothing becomes active without your approval.",
    historyDoneDetail: (exchanges: number, proposed: number) => `${exchanges} conversations read · ${proposed} proposals pending`,
    runAgain: "Read again",
    start: "Read earlier replies",
    readOnly: "Only admins can change rules. You can still view them.",
    successApproved: "Approved. Support One uses this rule from now on.",
    successRejected: "Proposal rejected.",
    successRemoved: "Rule removed.",
    successSaved: "Change saved.",
    retry: "Try again",
    emptyRules: "Nothing in this category yet.",
    sourceMailbox: "From earlier replies",
    sourceLearning: "From a correction",
    sourceManual: "Added by you",
    ruleTypes: { house_rule: "House rules", fact: "Business facts", exemplar: "Example replies" },
    corrections: "Corrections",
    correctionsSummary: (reviewed: number, corrections: number) => `${reviewed} sent replies checked · ${corrections} substantively edited`,
    noLearning: "No corrections yet. They appear once an edited reply has been sent.",
    sourceReply: "View the reply",
    proposedLesson: "Proposed rule",
    approvedLesson: "Approved rule",
    classification: { fact: "Business fact", policy: "Policy", tone: "Tone", structure: "Structure", other: "Other" },
    eventStatus: { processing: "Processing", processed: "Processed", proposed: "Proposal created", ignored: "Not reusable", failed: "Processing failed" },
    approved: "Approved",
    editRule: "Edit",
    rejectRule: "Reject",
    removeRule: "Remove rule",
  };

  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [facts, setFacts] = useState<ProfileFact[]>([]);
  const [job, setJob] = useState<MiningJob | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [startingMine, setStartingMine] = useState(false);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics>(EMPTY_METRICS);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const jobStatusRef = useRef<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [profileRes, jobRes] = await Promise.all([
        appFetch("/api/agent-profile", { cache: "no-store" }),
        appFetch("/api/onboarding/mine", { cache: "no-store" }),
      ]);
      if (!profileRes.ok) throw new Error(ta.loadError);
      const profileData = await profileRes.json();
      setProfile(profileData.profile ?? null);
      setFacts((profileData.facts ?? []) as ProfileFact[]);
      setCanManage(Boolean(profileData.canManage));
      setLearningEvents((profileData.learning?.events ?? []) as LearningEvent[]);
      setLearningMetrics(profileData.learning?.metrics ?? EMPTY_METRICS);

      if (jobRes.ok) {
        const jobData = await jobRes.json();
        setJob((jobData.job ?? null) as MiningJob | null);
      }
    } catch (loadError) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : ta.loadError);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [ta.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading || window.location.hash !== "#leervoorstellen") return;
    window.requestAnimationFrame(() => document.getElementById("leervoorstellen")?.scrollIntoView({ block: "start" }));
  }, [loading]);

  useEffect(() => {
    const active = job && ["queued", "running", "distilling"].includes(job.status);
    jobStatusRef.current = job?.status ?? null;
    if (!active) return;
    const interval = window.setInterval(async () => {
      const response = await appFetch("/api/onboarding/mine", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json();
      const next = (data.job ?? null) as MiningJob | null;
      setJob(next);
      if (next?.status === "done" && jobStatusRef.current !== "done") await load(true);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [job, load]);

  async function startMining() {
    setStartingMine(true);
    setError(null);
    setNotice(null);
    try {
      const response = await appFetch("/api/onboarding/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthsBack: 12 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? ta.actionError);
      await load(true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : ta.actionError);
    } finally {
      setStartingMine(false);
    }
  }

  async function updateFact(id: string, status: "approved" | "rejected") {
    const wasApproved = facts.find((fact) => fact.id === id)?.status === "approved";
    setBusyIds((previous) => new Set(previous).add(id));
    setError(null);
    setNotice(null);
    const previousFacts = facts;
    setFacts((current) => status === "rejected"
      ? current.filter((fact) => fact.id !== id)
      : current.map((fact) => fact.id === id ? { ...fact, status } : fact));
    try {
      const response = await appFetch(`/api/agent-profile/facts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error();
      setLearningEvents((current) => current.map((event) => event.proposed_fact_id === id
        ? { ...event, status: status === "approved" ? "processed" : "ignored" }
        : event));
      if (status === "approved") setProfile((current) => current ? { ...current, status: "active" } : current);
      setNotice(status === "approved" ? copy.successApproved : wasApproved ? copy.successRemoved : copy.successRejected);
    } catch {
      setFacts(previousFacts);
      setError(ta.actionError);
    } finally {
      setBusyIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }

  async function saveFactContent(id: string) {
    const content = editContent.trim();
    if (!content) return;
    setBusyIds((previous) => new Set(previous).add(id));
    setError(null);
    setNotice(null);
    try {
      const response = await appFetch(`/api/agent-profile/facts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error();
      setFacts((current) => current.map((fact) => fact.id === id ? { ...fact, content } : fact));
      setEditingFactId(null);
      setEditContent("");
      setNotice(copy.successSaved);
    } catch {
      setError(ta.actionError);
    } finally {
      setBusyIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }

  const proposedFacts = facts.filter((fact) => fact.status === "proposed");
  const approvedFacts = facts.filter((fact) => fact.status === "approved");
  const factsById = useMemo(() => new Map(facts.map((fact) => [fact.id, fact])), [facts]);
  const learningEventByFactId = useMemo(() => new Map(learningEvents
    .filter((event) => event.proposed_fact_id)
    .map((event) => [event.proposed_fact_id as string, event])), [learningEvents]);
  const approvedByKind = {
    house_rule: approvedFacts.filter((fact) => fact.kind === "house_rule"),
    fact: approvedFacts.filter((fact) => fact.kind === "fact"),
    exemplar: approvedFacts.filter((fact) => fact.kind === "exemplar"),
  };
  const miningActive = Boolean(job && ["queued", "running", "distilling"].includes(job.status));

  function sourceLabel(origin: ProfileFact["origin"]) {
    if (origin === "learning") return copy.sourceLearning;
    if (origin === "manual") return copy.sourceManual;
    return copy.sourceMailbox;
  }

  function editControls(fact: ProfileFact, busy: boolean) {
    return (
      <>
        <button type="button" className="agent-profile-button primary" disabled={busy || !editContent.trim()} onClick={() => saveFactContent(fact.id)}>
          {busy ? <Loader2 className="agent-profile-spin" size={14} /> : <Save size={14} />} {ta.saveEdit}
        </button>
        <button type="button" className="agent-profile-button" disabled={busy} onClick={() => { setEditingFactId(null); setEditContent(""); }}>
          {ta.cancelEdit}
        </button>
      </>
    );
  }

  function renderContent(fact: ProfileFact) {
    return editingFactId === fact.id ? (
      <textarea
        value={editContent}
        onChange={(event) => setEditContent(event.target.value)}
        rows={4}
        autoFocus
        aria-label={copy.editRule}
      />
    ) : <p>{fact.content}</p>;
  }

  // Een voorstel zoals op de landing: wat er in het antwoord veranderde,
  // de afspraak die daaruit volgt, en één duidelijke beslissing.
  function renderProposal(fact: ProfileFact) {
    const busy = busyIds.has(fact.id);
    const editing = editingFactId === fact.id;
    const learningEvent = fact.origin === "learning" ? learningEventByFactId.get(fact.id) : null;
    const removed = learningEvent?.normalized_diff?.removed?.slice(0, 12).join(" ");
    const added = learningEvent?.normalized_diff?.added?.slice(0, 12).join(" ");
    return (
      <article className="agent-profile-proposal" key={fact.id}>
        <div className="agent-profile-proposal-meta">
          <span className="agent-profile-pill">{copy.pending}</span>
          <span>{sourceLabel(fact.origin)}{fact.intent ? ` · ${supportLabel("intent", fact.intent, language)}` : ""}</span>
        </div>
        {learningEvent && (removed || added) ? (
          <div className="agent-profile-change" aria-label={copy.fromCorrection}>
            {removed ? <s>{removed}</s> : null}
            {removed && added ? <ArrowRight size={14} aria-hidden="true" /> : null}
            {added ? <strong>{added}</strong> : null}
          </div>
        ) : null}
        <div className="agent-profile-proposal-rule">{renderContent(fact)}</div>
        <div className="agent-profile-proposal-foot">
          {canManage ? (
            <div className="agent-profile-actions">
              {editing ? editControls(fact, busy) : (
                <>
                  <button type="button" className="agent-profile-button primary" disabled={busy} onClick={() => updateFact(fact.id, "approved")}>
                    {busy ? <Loader2 className="agent-profile-spin" size={14} /> : <Check size={14} />} {ta.approve}
                  </button>
                  <button type="button" className="agent-profile-button" disabled={busy} onClick={() => { setEditingFactId(fact.id); setEditContent(fact.content); }}>
                    <Pencil size={13} /> {copy.editRule}
                  </button>
                  <button type="button" className="agent-profile-button ghost" disabled={busy} onClick={() => updateFact(fact.id, "rejected")}>
                    {copy.rejectRule}
                  </button>
                </>
              )}
            </div>
          ) : <span />}
          {learningEvent?.conversation_id ? <Link className="agent-profile-link" href={`/inbox/${learningEvent.conversation_id}`}>{copy.sourceCorrection}<ArrowRight size={12} /></Link> : null}
        </div>
      </article>
    );
  }

  function renderRule(fact: ProfileFact) {
    const busy = busyIds.has(fact.id);
    const editing = editingFactId === fact.id;
    return (
      <div className="agent-profile-rule" key={fact.id}>
        {renderContent(fact)}
        {canManage ? (
          <div className="agent-profile-rule-actions">
            {editing ? editControls(fact, busy) : (
              <>
                <button type="button" className="agent-profile-button icon" disabled={busy} onClick={() => { setEditingFactId(fact.id); setEditContent(fact.content); }} aria-label={copy.editRule} title={copy.editRule}>
                  <Pencil size={13} />
                </button>
                <button type="button" className="agent-profile-button icon danger" disabled={busy} onClick={() => updateFact(fact.id, "rejected")} aria-label={copy.removeRule} title={copy.removeRule}>
                  {busy ? <Loader2 className="agent-profile-spin" size={13} /> : <X size={14} />}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  function renderRuleSection(kind: ProfileFact["kind"]) {
    const items = approvedByKind[kind];
    return (
      <section className="agent-profile-rule-section" key={kind}>
        <div className="agent-profile-rule-head">
          <strong>{copy.ruleTypes[kind]}</strong>
          <span>{items.length}</span>
        </div>
        <div className="agent-profile-rule-list">
          {items.length ? items.map((fact) => renderRule(fact)) : <div className="agent-profile-rule-empty">{copy.emptyRules}</div>}
        </div>
      </section>
    );
  }

  const hasAnything = Boolean(profile || facts.length || learningEvents.length || miningActive);

  const miningRow = (
    <div className="agent-profile-mining">
      <div className="agent-profile-mining-copy">
        {miningActive ? <Loader2 className="agent-profile-spin" size={16} /> : <MailSearch size={16} />}
        <div>
          <strong>{miningActive ? copy.historyRunning : job?.status === "done" ? copy.historyReady : copy.historyInitial}</strong>
          <p>
            {miningActive
              ? job?.phase ?? `${job?.sent_scanned ?? 0} ${nl ? "mails gelezen" : "emails read"}`
              : job?.status === "failed"
                ? job.error ?? ta.actionError
                : job?.status === "done"
                  ? copy.historyDoneDetail(job.exchanges_mined, proposedFacts.length)
                  : copy.historyInitialDetail}
          </p>
        </div>
      </div>
      {canManage && !miningActive ? (
        <button type="button" className="agent-profile-button" onClick={startMining} disabled={startingMine}>
          {startingMine ? <Loader2 className="agent-profile-spin" size={14} /> : <RefreshCw size={14} />}
          {job?.status === "done" ? copy.runAgain : job?.status === "failed" ? ta.miningRetry : copy.start}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <AgentProfileStyles />
      <main className="agent-profile-page">
        <header className="agent-profile-head">
          <div>
            <h1>{ta.title}</h1>
            <p>{ta.subtitle}</p>
          </div>
        </header>

        {loading ? (
          <div className="agent-profile-stack" aria-label={t.common.loading}>
            <div className="agent-profile-skeleton" />
            <div className="agent-profile-skeleton" />
          </div>
        ) : (
          <div className="agent-profile-stack">
            {error ? (
              <div className="agent-profile-notice error" role="alert">
                <AlertCircle size={17} />
                <div><strong>{error}</strong><button type="button" onClick={() => load()}><RefreshCw size={12} /> {copy.retry}</button></div>
              </div>
            ) : null}
            <div aria-live="polite">
              {notice ? <div className="agent-profile-notice success"><CheckCircle2 size={17} /><div><strong>{notice}</strong></div></div> : null}
            </div>
            {!canManage ? (
              <div className="agent-profile-notice">
                <ShieldCheck size={17} />
                <div><strong>{copy.readOnly}</strong></div>
              </div>
            ) : null}

            {!hasAnything ? (
              <section className="agent-profile-section" id="leervoorstellen">
                <div className="agent-profile-empty">
                  <SequenceMark size={72} state="idle" title="" />
                  <strong>{ta.emptyTitle}</strong>
                  <p>{ta.emptyDesc}</p>
                </div>
                {miningRow}
              </section>
            ) : (
              <>
                <section className="agent-profile-section" id="leervoorstellen">
                  <div className="agent-profile-section-head">
                    <SequenceMark size={40} state={proposedFacts.length ? "reading" : "idle"} title="" />
                    <div className="agent-profile-section-title">
                      <h2>{copy.reviewTitle}{proposedFacts.length ? <span className="agent-profile-count">{proposedFacts.length}</span> : null}</h2>
                      <p>{proposedFacts.length ? copy.reviewDesc : copy.noProposals}</p>
                    </div>
                  </div>
                  {proposedFacts.length ? (
                    <div className="agent-profile-proposals">
                      {proposedFacts.map((fact) => renderProposal(fact))}
                    </div>
                  ) : null}
                </section>

                <section className="agent-profile-section">
                  <div className="agent-profile-section-head">
                    <div className="agent-profile-section-title">
                      <h2>{copy.activeKnowledge}</h2>
                      <p>{copy.activeKnowledgeDesc}</p>
                    </div>
                  </div>
                  <div className="agent-profile-section-body">
                    <div className="agent-profile-rules-grid">
                      {renderRuleSection("house_rule")}
                      {renderRuleSection("fact")}
                      {renderRuleSection("exemplar")}
                    </div>
                  </div>
                </section>

                <section className="agent-profile-section">
                  <div className="agent-profile-section-head">
                    <div className="agent-profile-section-title">
                      <h2>{ta.sectionIdentity}</h2>
                      <p>{copy.identityDesc}</p>
                    </div>
                  </div>
                  <dl className="agent-profile-identity">
                    {[
                      { label: ta.greeting, value: profile?.identity?.greeting },
                      { label: ta.signoff, value: profile?.identity?.signoff },
                      { label: ta.pronoun, value: profile?.identity?.pronoun },
                      { label: ta.companyDescriptor, value: profile?.identity?.company_descriptor },
                      { label: ta.voiceNotes, value: profile?.voice_notes },
                    ].map((item) => (
                      <div className="agent-profile-identity-item" key={item.label}>
                        <dt>{item.label}</dt><dd>{item.value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                  {miningRow}
                </section>

                <details className="agent-profile-section agent-profile-history">
                  <summary>
                    <div className="agent-profile-section-title">
                      <h2>{copy.corrections}</h2>
                      <p>{copy.correctionsSummary(learningMetrics.reviewedDecisions, learningMetrics.corrections)}</p>
                    </div>
                    <ChevronDown size={16} />
                  </summary>
                  <div className="agent-profile-section-body">
                    {learningEvents.length ? (
                      <div className="agent-profile-events">
                        {learningEvents.slice(0, 12).map((event) => {
                          const linkedFact = event.proposed_fact_id ? factsById.get(event.proposed_fact_id) : null;
                          const eventStatus = linkedFact?.status === "approved" ? copy.approved : copy.eventStatus[event.status];
                          return (
                          <details className="agent-profile-event" key={event.id}>
                            <summary>
                              <div className="agent-profile-event-title">
                                <strong>{copy.classification[event.classification]}</strong>
                                <span>{eventStatus}</span>
                              </div>
                              <span className="agent-profile-event-date">{formatDate(event.processed_at, locale)}</span>
                              <ChevronDown size={15} />
                            </summary>
                            <div className="agent-profile-event-body">
                              <div className="agent-profile-comparison">
                                <div><span>{ta.learningAiDraft}</span><p>{event.normalized_ai}</p></div>
                                <div><span>{ta.learningHumanDraft}</span><p>{event.normalized_human}</p></div>
                              </div>
                              {event.candidate_rule ? (
                                <div className="agent-profile-notice success">
                                  <Check size={15} /><div><strong>{linkedFact?.status === "approved" ? copy.approvedLesson : copy.proposedLesson}</strong><p>{linkedFact?.content ?? event.candidate_rule}</p></div>
                                </div>
                              ) : null}
                              {event.conversation_id ? (
                                <Link className="agent-profile-link" href={`/inbox/${event.conversation_id}`}>{copy.sourceReply}<ArrowRight size={12} /></Link>
                              ) : null}
                            </div>
                          </details>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="agent-profile-muted">{copy.noLearning}</p>
                    )}
                  </div>
                </details>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
