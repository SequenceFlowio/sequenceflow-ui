"use client";

import {
  Activity,
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  History,
  Loader2,
  MailSearch,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
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
    .agent-profile-page{width:min(100%,1120px);margin:0 auto;padding:40px 24px 72px;color:var(--sf-text)}
    .agent-profile-head{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:22px}
    .agent-profile-head h1{margin:0;font-size:28px;font-weight:800;letter-spacing:0}
    .agent-profile-head p{max-width:720px;margin:7px 0 0;color:var(--sf-text-muted);font-size:14px;line-height:1.6}
    .agent-profile-stack{display:grid;gap:16px}
    .agent-profile-section{min-width:0;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface);overflow:hidden}
    .agent-profile-section-head{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:62px;padding:14px 16px;border-bottom:1px solid var(--sf-border);background:var(--sf-surface-2)}
    .agent-profile-section-title{display:flex;align-items:center;gap:10px;min-width:0}
    .agent-profile-section-icon,.agent-profile-status-icon,.agent-profile-empty-icon{display:grid;place-items:center;flex:none;margin:0;border-radius:7px}
    .agent-profile-section-icon{width:32px;height:32px;background:#eff8df;color:#60891c}
    .agent-profile-section-title h2{margin:0;font-size:13px;font-weight:800}
    .agent-profile-section-title p{margin:3px 0 0;color:var(--sf-text-muted);font-size:11px;line-height:1.45}
    .agent-profile-section-body{padding:16px}
    .agent-profile-status{margin-bottom:16px}
    .agent-profile-status-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 16px;border-bottom:1px solid var(--sf-border);background:var(--sf-surface-2)}
    .agent-profile-status-title{display:flex;align-items:center;gap:10px;min-width:0}
    .agent-profile-status-icon{width:32px;height:32px;background:#eff8df;color:#60891c}
    .agent-profile-status-icon.warning{background:#fff3d5;color:#9a6700}
    .agent-profile-status-title strong{display:block;font-size:13px}
    .agent-profile-status-title p{margin:2px 0 0;color:var(--sf-text-muted);font-size:11px}
    .agent-profile-status-time{color:var(--sf-text-subtle);font-size:10px;white-space:nowrap}
    .agent-profile-status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
    .agent-profile-status-item{min-width:0;padding:13px 15px;border-right:1px solid var(--sf-border)}
    .agent-profile-status-item:last-child{border-right:0}
    .agent-profile-status-item>span{display:flex;align-items:center;gap:6px;color:var(--sf-text-muted);font-size:10px;font-weight:800;text-transform:uppercase}
    .agent-profile-status-item strong{display:block;margin-top:5px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .agent-profile-status-item p{margin:3px 0 0;color:var(--sf-text-muted);font-size:10px;line-height:1.4}
    .agent-profile-badge{display:inline-flex;align-items:center;gap:5px;min-height:25px;padding:0 8px;border:1px solid var(--sf-border);border-radius:999px;color:var(--sf-text-muted);font-size:10px;font-weight:800;white-space:nowrap}
    .agent-profile-badge.success{border-color:#d4edaa;background:#f5faea;color:#527717}
    .agent-profile-badge.warning{border-color:#f2dda5;background:#fff8e6;color:#8a5d00}
    .agent-profile-badge.info{border-color:#cfe1ff;background:#f2f7ff;color:#285ea8}
    .agent-profile-notice{display:flex;align-items:flex-start;gap:10px;padding:12px 13px;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface-2);color:var(--sf-text-muted);font-size:12px;line-height:1.5}
    .agent-profile-notice.success{border-color:#d4edaa;background:#f5faea;color:#527717}
    .agent-profile-notice.warning{border-color:#f2dda5;background:#fff8e6;color:#8a5d00}
    .agent-profile-notice.error{border-color:#ffd2cc;background:#fff2f0;color:#b42318}
    .agent-profile-notice>svg{flex:none;margin-top:1px}
    .agent-profile-notice>div{flex:1}
    .agent-profile-notice strong{display:block}
    .agent-profile-notice p{margin:2px 0 0}
    .agent-profile-notice button{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:0;border:0;background:transparent;color:inherit;font:800 11px inherit;cursor:pointer}
    .agent-profile-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .agent-profile-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:0 12px;border:1px solid var(--sf-border);border-radius:7px;background:var(--sf-surface);color:var(--sf-text);font:800 11px inherit;cursor:pointer}
    .agent-profile-button:hover{background:var(--sf-surface-2)}
    .agent-profile-button.primary{border-color:#b9ed59;background:#c7f56f;color:#172500}
    .agent-profile-button.danger{border-color:#ffd2cc;background:var(--sf-surface);color:#b42318}
    .agent-profile-button.icon{width:34px;min-height:34px;padding:0}
    .agent-profile-button:disabled{cursor:not-allowed;opacity:.5}
    .agent-profile-mining{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 16px}
    .agent-profile-mining-copy{display:flex;align-items:flex-start;gap:10px;min-width:0}
    .agent-profile-mining-copy>svg{flex:none;margin-top:1px;color:#60891c}
    .agent-profile-mining-copy strong{display:block;font-size:12px}
    .agent-profile-mining-copy p{margin:3px 0 0;color:var(--sf-text-muted);font-size:11px;line-height:1.5}
    .agent-profile-proposals{display:grid}
    .agent-profile-fact{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:14px;padding:14px 16px;border-bottom:1px solid var(--sf-border)}
    .agent-profile-fact:last-child{border-bottom:0}
    .agent-profile-fact-content{min-width:0}
    .agent-profile-fact-content>p{margin:0;color:var(--sf-text);font-size:12px;line-height:1.6;white-space:pre-wrap}
    .agent-profile-fact-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px}
    .agent-profile-fact textarea{width:100%;min-height:92px;resize:vertical;border:1px solid var(--sf-border);border-radius:7px;background:var(--sf-surface);color:var(--sf-text);padding:10px;font:12px/1.6 inherit;outline:none}
    .agent-profile-fact textarea:focus{border-color:#9fda3d;box-shadow:0 0 0 3px rgba(159,218,61,.13)}
    .agent-profile-fact-actions{display:flex;align-items:center;gap:7px;flex:none}
    .agent-profile-identity{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--sf-border)}
    .agent-profile-identity-item{min-width:0;padding:13px 15px;border-right:1px solid var(--sf-border)}
    .agent-profile-identity-item:last-child{border-right:0}
    .agent-profile-identity-item span{display:block;color:var(--sf-text-muted);font-size:9px;font-weight:800;text-transform:uppercase}
    .agent-profile-identity-item p{margin:5px 0 0;color:var(--sf-text);font-size:12px;line-height:1.5;white-space:pre-wrap}
    .agent-profile-voice{padding:14px 16px}
    .agent-profile-voice span{display:block;color:var(--sf-text-muted);font-size:9px;font-weight:800;text-transform:uppercase}
    .agent-profile-voice p{margin:5px 0 0;color:var(--sf-text);font-size:12px;line-height:1.6}
    .agent-profile-rules-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--sf-border);border-radius:8px;overflow:hidden}
    .agent-profile-rule-section{min-width:0;border-right:1px solid var(--sf-border)}
    .agent-profile-rule-section:last-child{border-right:0}
    .agent-profile-rule-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:55px;padding:12px 14px;border-bottom:1px solid var(--sf-border);background:var(--sf-surface-2)}
    .agent-profile-rule-head>div{display:flex;align-items:center;gap:8px;min-width:0}
    .agent-profile-rule-head svg{flex:none;color:#60891c}
    .agent-profile-rule-head strong{font-size:12px}
    .agent-profile-rule-head span{color:var(--sf-text-muted);font-size:10px;font-weight:800}
    .agent-profile-rule-list{display:grid}
    .agent-profile-rule{padding:12px 14px;border-bottom:1px solid var(--sf-border)}
    .agent-profile-rule:last-child{border-bottom:0}
    .agent-profile-rule>p{margin:0;color:var(--sf-text);font-size:11px;line-height:1.55;white-space:pre-wrap}
    .agent-profile-rule-empty{padding:20px 14px;color:var(--sf-text-muted);font-size:11px;line-height:1.5;text-align:center}
    .agent-profile-learning-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--sf-border);border-radius:8px;overflow:hidden}
    .agent-profile-learning-metric{padding:12px 14px}
    .agent-profile-learning-metric+.agent-profile-learning-metric{border-left:1px solid var(--sf-border)}
    .agent-profile-learning-metric span,.agent-profile-learning-metric strong,.agent-profile-learning-metric small{display:block}
    .agent-profile-learning-metric span{color:var(--sf-text-muted);font-size:9px;font-weight:800;text-transform:uppercase}
    .agent-profile-learning-metric strong{margin-top:4px;font-size:20px}
    .agent-profile-learning-metric small{margin-top:3px;color:var(--sf-text-subtle);font-size:9px}
    .agent-profile-events{margin-top:14px;border:1px solid var(--sf-border);border-radius:8px;overflow:hidden}
    .agent-profile-event{border-bottom:1px solid var(--sf-border)}
    .agent-profile-event:last-child{border-bottom:0}
    .agent-profile-event summary{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:12px 14px;list-style:none;cursor:pointer}
    .agent-profile-event summary::-webkit-details-marker{display:none}
    .agent-profile-event-title{min-width:0}
    .agent-profile-event-title strong{display:block;font-size:11px}
    .agent-profile-event-title span{display:block;margin-top:2px;color:var(--sf-text-muted);font-size:10px}
    .agent-profile-event-date{color:var(--sf-text-muted);font-size:10px;white-space:nowrap}
    .agent-profile-event summary>svg{color:var(--sf-text-muted);transition:transform .2s}
    .agent-profile-event[open] summary>svg{transform:rotate(180deg)}
    .agent-profile-event-body{display:grid;gap:12px;padding:0 14px 14px}
    .agent-profile-comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .agent-profile-comparison>div{padding:11px 12px;border:1px solid var(--sf-border);border-radius:7px;background:var(--sf-surface-2)}
    .agent-profile-comparison span{display:block;color:var(--sf-text-muted);font-size:9px;font-weight:800;text-transform:uppercase}
    .agent-profile-comparison p{margin:5px 0 0;color:var(--sf-text);font-size:11px;line-height:1.55;white-space:pre-wrap}
    .agent-profile-diff{display:grid;gap:6px;padding:10px 12px;border-radius:7px;background:var(--sf-surface-2);font-size:10px;line-height:1.55}
    .agent-profile-diff p{margin:0}
    .agent-profile-diff .removed{color:#b42318}
    .agent-profile-diff .added{color:#527717}
    .agent-profile-source{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--sf-text-muted);font-size:10px}
    .agent-profile-source a{display:inline-flex;align-items:center;gap:5px;color:#527717;font-weight:800;text-decoration:none}
    .agent-profile-empty{display:grid;place-items:center;align-content:center;gap:8px;min-height:180px;padding:28px;text-align:center}
    .agent-profile-empty-icon{width:38px;height:38px;background:var(--sf-surface-2);color:var(--sf-text-muted)}
    .agent-profile-empty strong{font-size:13px}
    .agent-profile-empty p{max-width:480px;margin:0;color:var(--sf-text-muted);font-size:11px;line-height:1.55}
    .agent-profile-skeleton{height:142px;border-radius:8px;background:linear-gradient(90deg,var(--sf-surface-2) 20%,var(--sf-bg) 50%,var(--sf-surface-2) 80%);background-size:220% 100%;animation:agentProfileSkeleton 1.2s infinite}
    .agent-profile-spin{animation:agentProfileSpin .8s linear infinite}
    @keyframes agentProfileSpin{to{transform:rotate(360deg)}}@keyframes agentProfileSkeleton{to{background-position:-20% 0}}
    .agent-profile-page svg{display:block}
    @media(max-width:900px){.agent-profile-status-grid,.agent-profile-identity{grid-template-columns:repeat(2,minmax(0,1fr))}.agent-profile-status-item:nth-child(2),.agent-profile-identity-item:nth-child(2){border-right:0}.agent-profile-status-item:nth-child(-n+2),.agent-profile-identity-item:nth-child(-n+2){border-bottom:1px solid var(--sf-border)}.agent-profile-rules-grid{grid-template-columns:1fr}.agent-profile-rule-section{width:100%;border-right:0;border-bottom:1px solid var(--sf-border)}.agent-profile-rule-section:last-child{border-bottom:0}}
    @media(max-width:640px){.agent-profile-page{padding:28px 16px 56px}.agent-profile-head{align-items:flex-start;flex-direction:column}.agent-profile-status-head,.agent-profile-mining{align-items:flex-start;flex-direction:column}.agent-profile-status-time{display:none}.agent-profile-status-grid,.agent-profile-identity,.agent-profile-learning-metrics{grid-template-columns:1fr}.agent-profile-status-item,.agent-profile-identity-item{border-right:0!important;border-bottom:1px solid var(--sf-border)!important}.agent-profile-status-item:last-child,.agent-profile-identity-item:last-child{border-bottom:0!important}.agent-profile-learning-metric+.agent-profile-learning-metric{border-left:0;border-top:1px solid var(--sf-border)}.agent-profile-fact{grid-template-columns:1fr}.agent-profile-fact-actions{justify-content:flex-end}.agent-profile-section-head{align-items:flex-start;flex-direction:column}.agent-profile-comparison{grid-template-columns:1fr}.agent-profile-event summary{grid-template-columns:minmax(0,1fr) auto}.agent-profile-event-date{display:none}}
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
    ready: "Agent DNA is actief",
    readyDetail: "Goedgekeurde regels worden gebruikt bij nieuwe antwoorden.",
    attention: "Agent DNA vraagt aandacht",
    attentionDetail: "Controleer de openstaande voorstellen of activeer het profiel.",
    status: "Profielstatus",
    statusActive: "Actief in antwoorden",
    statusDraft: "Nog niet actief",
    approved: "Goedgekeurd",
    approvedDetail: "regels beschikbaar",
    proposals: "Te beoordelen",
    proposalsDetail: "voorstellen wachten",
    learning: "Leersignalen",
    learningDetail: "verzonden antwoorden gemeten",
    analyzed: "Laatst opgebouwd",
    notAnalyzed: "Nog niet opgebouwd",
    reviewTitle: "Voorstellen beoordelen",
    reviewDesc: "Nieuwe inzichten worden nooit automatisch actief. Controleer ze voordat de agent ze gebruikt.",
    noProposals: "Geen voorstellen open",
    noProposalsDetail: "Alle gevonden profielregels zijn beoordeeld.",
    activeKnowledge: "Wat de agent nu gebruikt",
    activeKnowledgeDesc: "Alleen deze goedgekeurde regels worden meegenomen in nieuwe antwoorden.",
    identityDesc: "De vaste stem en afzenderidentiteit van je support-agent.",
    historyTitle: "Mailboxhistorie",
    historyReady: "Analyse voltooid",
    historyRunning: "Mailboxhistorie wordt geanalyseerd",
    historyInitial: "Bouw je Agent DNA op uit eerdere antwoorden",
    historyInitialDetail: "SequenceFlow leest alleen je Verzonden-map en maakt voorstellen. Er wordt niets automatisch actief.",
    historyDoneDetail: (exchanges: number, proposed: number) => `${exchanges} gesprekken geanalyseerd · ${proposed} voorstellen open`,
    runAgain: "Opnieuw analyseren",
    start: "Historie analyseren",
    readOnly: "Alleen admins kunnen Agent DNA aanpassen. Je kunt het profiel en de leerhistorie wel bekijken.",
    successApproved: "Regel goedgekeurd en beschikbaar voor de agent.",
    successRejected: "Voorstel afgewezen.",
    successSaved: "Wijziging opgeslagen.",
    successActivated: "Agent DNA is geactiveerd.",
    successDeactivated: "Agent DNA is gedeactiveerd.",
    retry: "Opnieuw proberen",
    emptyRules: "Nog geen goedgekeurde regels in deze categorie.",
    sourceMailbox: "Uit mailboxhistorie",
    sourceLearning: "Geleerd uit correctie",
    sourceManual: "Handmatig toegevoegd",
    ruleTypes: { house_rule: "Huisregel", fact: "Bedrijfsfeit", exemplar: "Voorbeeldantwoord" },
    confidence: "zekerheid",
    correctionRateDetail: "antwoorden inhoudelijk aangepast",
    medianDetail: "mediane grootte van een correctie",
    reviewedDetail: "antwoorden meegenomen in de leerlus",
    learningHistory: "Recente correcties",
    learningHistoryDesc: "Bekijk wat de AI schreef, wat een medewerker wijzigde en welke les daaruit kwam.",
    noLearning: "Nog geen correcties beschikbaar. De leerlus vult zich wanneer aangepaste antwoorden worden verzonden.",
    sourceReply: "Open bronantwoord",
    proposedLesson: "Voorgestelde les",
    classification: { fact: "Bedrijfsfeit", policy: "Beleid", tone: "Toon", structure: "Opbouw", other: "Overig" },
    eventStatus: { processing: "Wordt verwerkt", processed: "Verwerkt", proposed: "Voorstel gemaakt", ignored: "Niet herbruikbaar", failed: "Verwerking mislukt" },
    change: "wijziging",
    deactivateConfirm: "Agent DNA deactiveren? Nieuwe antwoorden gebruiken de goedgekeurde profielregels dan niet meer.",
    editRule: "Regel bewerken",
    rejectRule: "Voorstel afwijzen",
  } : {
    ready: "Agent DNA is active",
    readyDetail: "Approved rules are used for new replies.",
    attention: "Agent DNA needs attention",
    attentionDetail: "Review pending proposals or activate the profile.",
    status: "Profile status",
    statusActive: "Active in replies",
    statusDraft: "Not active yet",
    approved: "Approved",
    approvedDetail: "rules available",
    proposals: "Needs review",
    proposalsDetail: "proposals waiting",
    learning: "Learning signals",
    learningDetail: "sent replies measured",
    analyzed: "Last built",
    notAnalyzed: "Not built yet",
    reviewTitle: "Review proposals",
    reviewDesc: "New insights never become active automatically. Review them before the agent can use them.",
    noProposals: "No proposals pending",
    noProposalsDetail: "All discovered profile rules have been reviewed.",
    activeKnowledge: "What the agent uses now",
    activeKnowledgeDesc: "Only these approved rules are included in new replies.",
    identityDesc: "The fixed voice and sender identity of your support agent.",
    historyTitle: "Mailbox history",
    historyReady: "Analysis complete",
    historyRunning: "Analyzing mailbox history",
    historyInitial: "Build Agent DNA from earlier replies",
    historyInitialDetail: "SequenceFlow only reads your Sent folder and creates proposals. Nothing becomes active automatically.",
    historyDoneDetail: (exchanges: number, proposed: number) => `${exchanges} conversations analyzed · ${proposed} proposals pending`,
    runAgain: "Analyze again",
    start: "Analyze history",
    readOnly: "Only admins can edit Agent DNA. You can still view the profile and learning history.",
    successApproved: "Rule approved and available to the agent.",
    successRejected: "Proposal rejected.",
    successSaved: "Change saved.",
    successActivated: "Agent DNA activated.",
    successDeactivated: "Agent DNA deactivated.",
    retry: "Try again",
    emptyRules: "No approved rules in this category yet.",
    sourceMailbox: "From mailbox history",
    sourceLearning: "Learned from correction",
    sourceManual: "Added manually",
    ruleTypes: { house_rule: "House rule", fact: "Business fact", exemplar: "Example reply" },
    confidence: "confidence",
    correctionRateDetail: "replies substantively changed",
    medianDetail: "median size of a correction",
    reviewedDetail: "replies included in the learning loop",
    learningHistory: "Recent corrections",
    learningHistoryDesc: "See what the AI wrote, what a teammate changed, and which lesson was found.",
    noLearning: "No corrections available yet. The learning loop fills as edited replies are sent.",
    sourceReply: "Open source reply",
    proposedLesson: "Proposed lesson",
    classification: { fact: "Business fact", policy: "Policy", tone: "Tone", structure: "Structure", other: "Other" },
    eventStatus: { processing: "Processing", processed: "Processed", proposed: "Proposal created", ignored: "Not reusable", failed: "Processing failed" },
    change: "change",
    deactivateConfirm: "Deactivate Agent DNA? New replies will no longer use the approved profile rules.",
    editRule: "Edit rule",
    rejectRule: "Reject proposal",
  };

  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [facts, setFacts] = useState<ProfileFact[]>([]);
  const [job, setJob] = useState<MiningJob | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [activating, setActivating] = useState(false);
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
        fetch("/api/agent-profile", { cache: "no-store" }),
        fetch("/api/onboarding/mine", { cache: "no-store" }),
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
    const active = job && ["queued", "running", "distilling"].includes(job.status);
    jobStatusRef.current = job?.status ?? null;
    if (!active) return;
    const interval = window.setInterval(async () => {
      const response = await fetch("/api/onboarding/mine", { cache: "no-store" }).catch(() => null);
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
      const response = await fetch("/api/onboarding/mine", {
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
    setBusyIds((previous) => new Set(previous).add(id));
    setError(null);
    setNotice(null);
    const previousFacts = facts;
    setFacts((current) => status === "rejected"
      ? current.filter((fact) => fact.id !== id)
      : current.map((fact) => fact.id === id ? { ...fact, status } : fact));
    try {
      const response = await fetch(`/api/agent-profile/facts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error();
      setNotice(status === "approved" ? copy.successApproved : copy.successRejected);
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
      const response = await fetch(`/api/agent-profile/facts/${id}`, {
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

  async function toggleProfileStatus() {
    if (!profile || !canManage) return;
    if (profile.status === "active" && !window.confirm(copy.deactivateConfirm)) return;
    const nextStatus = profile.status === "active" ? "draft" : "active";
    setActivating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/agent-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error();
      setProfile({ ...profile, status: nextStatus });
      setNotice(nextStatus === "active" ? copy.successActivated : copy.successDeactivated);
    } catch {
      setError(ta.actionError);
    } finally {
      setActivating(false);
    }
  }

  const proposedFacts = facts.filter((fact) => fact.status === "proposed");
  const approvedFacts = facts.filter((fact) => fact.status === "approved");
  const approvedByKind = {
    house_rule: approvedFacts.filter((fact) => fact.kind === "house_rule"),
    fact: approvedFacts.filter((fact) => fact.kind === "fact"),
    exemplar: approvedFacts.filter((fact) => fact.kind === "exemplar"),
  };
  const miningActive = Boolean(job && ["queued", "running", "distilling"].includes(job.status));
  const profileReady = profile?.status === "active" && approvedFacts.length > 0;

  function sourceLabel(origin: ProfileFact["origin"]) {
    if (origin === "learning") return copy.sourceLearning;
    if (origin === "manual") return copy.sourceManual;
    return copy.sourceMailbox;
  }

  function FactRow({ fact, proposal = false }: { fact: ProfileFact; proposal?: boolean }) {
    const busy = busyIds.has(fact.id);
    const editing = editingFactId === fact.id;
    return (
      <div className="agent-profile-fact">
        <div className="agent-profile-fact-content">
          {editing ? (
            <textarea
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              rows={4}
              autoFocus
              aria-label={copy.editRule}
            />
          ) : <p>{fact.content}</p>}
          <div className="agent-profile-fact-meta">
            <span className={`agent-profile-badge ${proposal ? "warning" : "success"}`}>
              {proposal ? ta.proposedBadge : ta.approvedBadge}
            </span>
            <span className="agent-profile-badge">{copy.ruleTypes[fact.kind]}</span>
            <span className={`agent-profile-badge ${fact.origin === "learning" ? "info" : ""}`}>
              {sourceLabel(fact.origin)}
            </span>
            {fact.intent ? <span className="agent-profile-badge">{fact.intent.replaceAll("_", " ")}</span> : null}
            {fact.confidence != null ? (
              <span className="agent-profile-badge">{Math.round(fact.confidence * 100)}% {copy.confidence}</span>
            ) : null}
          </div>
        </div>
        {canManage ? (
          <div className="agent-profile-fact-actions">
            {editing ? (
              <>
                <button type="button" className="agent-profile-button primary" disabled={busy || !editContent.trim()} onClick={() => saveFactContent(fact.id)}>
                  {busy ? <Loader2 className="agent-profile-spin" size={14} /> : <Save size={14} />} {ta.saveEdit}
                </button>
                <button type="button" className="agent-profile-button icon" disabled={busy} onClick={() => { setEditingFactId(null); setEditContent(""); }} aria-label={ta.cancelEdit} title={ta.cancelEdit}>
                  <X size={15} />
                </button>
              </>
            ) : (
              <button type="button" className="agent-profile-button icon" disabled={busy} onClick={() => { setEditingFactId(fact.id); setEditContent(fact.content); }} aria-label={copy.editRule} title={copy.editRule}>
                <Pencil size={14} />
              </button>
            )}
            {!editing && proposal ? (
              <>
                <button type="button" className="agent-profile-button primary" disabled={busy} onClick={() => updateFact(fact.id, "approved")}>
                  {busy ? <Loader2 className="agent-profile-spin" size={14} /> : <Check size={14} />} {ta.approve}
                </button>
                <button type="button" className="agent-profile-button icon danger" disabled={busy} onClick={() => updateFact(fact.id, "rejected")} aria-label={copy.rejectRule} title={copy.rejectRule}>
                  <X size={15} />
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function RuleSection({ kind, icon }: { kind: ProfileFact["kind"]; icon: React.ReactNode }) {
    const items = approvedByKind[kind];
    return (
      <section className="agent-profile-rule-section">
        <div className="agent-profile-rule-head">
          <div>{icon}<strong>{copy.ruleTypes[kind]}</strong></div>
          <span>{items.length}</span>
        </div>
        <div className="agent-profile-rule-list">
          {items.length ? items.map((fact) => <FactRow key={fact.id} fact={fact} />) : <div className="agent-profile-rule-empty">{copy.emptyRules}</div>}
        </div>
      </section>
    );
  }

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

            <section className="agent-profile-section agent-profile-status">
              <div className="agent-profile-status-head">
                <div className="agent-profile-status-title">
                  <span className={`agent-profile-status-icon ${profileReady ? "" : "warning"}`}>
                    {profileReady ? <ShieldCheck size={17} /> : <AlertCircle size={17} />}
                  </span>
                  <div>
                    <strong>{profileReady ? copy.ready : copy.attention}</strong>
                    <p>{profileReady ? copy.readyDetail : copy.attentionDetail}</p>
                  </div>
                </div>
                <span className="agent-profile-status-time">
                  {profile?.updated_at ? `${copy.analyzed}: ${formatDate(profile.updated_at, locale)}` : copy.notAnalyzed}
                </span>
              </div>
              <div className="agent-profile-status-grid">
                <div className="agent-profile-status-item">
                  <span><Bot size={13} /> {copy.status}</span>
                  <strong>{profile?.status === "active" ? copy.statusActive : copy.statusDraft}</strong>
                  <p>{profile ? `v${profile.version}` : copy.notAnalyzed}</p>
                </div>
                <div className="agent-profile-status-item">
                  <span><CheckCircle2 size={13} /> {copy.approved}</span>
                  <strong>{approvedFacts.length}</strong>
                  <p>{copy.approvedDetail}</p>
                </div>
                <div className="agent-profile-status-item">
                  <span><Clock3 size={13} /> {copy.proposals}</span>
                  <strong>{proposedFacts.length}</strong>
                  <p>{copy.proposalsDetail}</p>
                </div>
                <div className="agent-profile-status-item">
                  <span><Activity size={13} /> {copy.learning}</span>
                  <strong>{learningMetrics.reviewedDecisions}</strong>
                  <p>{copy.learningDetail}</p>
                </div>
              </div>
            </section>

            <section className="agent-profile-section">
              <div className="agent-profile-mining">
                <div className="agent-profile-mining-copy">
                  {miningActive ? <Loader2 className="agent-profile-spin" size={17} /> : <MailSearch size={17} />}
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
            </section>

            {!profile && !miningActive ? (
              <section className="agent-profile-section">
                <div className="agent-profile-empty">
                  <span className="agent-profile-empty-icon"><Bot size={18} /></span>
                  <strong>{ta.emptyTitle}</strong>
                  <p>{ta.emptyDesc}</p>
                </div>
              </section>
            ) : profile ? (
              <>
                <section className="agent-profile-section">
                  <div className="agent-profile-section-head">
                    <div className="agent-profile-section-title">
                      <span className="agent-profile-section-icon"><Sparkles size={17} /></span>
                      <div><h2>{copy.reviewTitle}</h2><p>{copy.reviewDesc}</p></div>
                    </div>
                    <div className="agent-profile-actions">
                      <span className={`agent-profile-badge ${proposedFacts.length ? "warning" : "success"}`}>
                        {proposedFacts.length ? `${proposedFacts.length} ${copy.proposals.toLowerCase()}` : copy.noProposals}
                      </span>
                    </div>
                  </div>
                  {proposedFacts.length ? (
                    <div className="agent-profile-proposals">
                      {proposedFacts.map((fact) => <FactRow key={fact.id} fact={fact} proposal />)}
                    </div>
                  ) : (
                    <div className="agent-profile-empty" style={{ minHeight: 120 }}>
                      <span className="agent-profile-empty-icon"><CheckCircle2 size={18} /></span>
                      <strong>{copy.noProposals}</strong>
                      <p>{copy.noProposalsDetail}</p>
                    </div>
                  )}
                </section>

                <section className="agent-profile-section">
                  <div className="agent-profile-section-head">
                    <div className="agent-profile-section-title">
                      <span className="agent-profile-section-icon"><MessageSquareText size={17} /></span>
                      <div><h2>{ta.sectionIdentity}</h2><p>{copy.identityDesc}</p></div>
                    </div>
                    <div className="agent-profile-actions">
                      <span className={`agent-profile-badge ${profile.status === "active" ? "success" : "warning"}`}>
                        {profile.status === "active" ? ta.profileActive : ta.profileDraft}
                      </span>
                      {canManage ? (
                        <button type="button" className={`agent-profile-button ${profile.status === "active" ? "" : "primary"}`} onClick={toggleProfileStatus} disabled={activating}>
                          {activating ? <Loader2 className="agent-profile-spin" size={14} /> : profile.status === "active" ? <X size={14} /> : <Check size={14} />}
                          {profile.status === "active" ? ta.deactivateBtn : ta.activateBtn}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="agent-profile-identity">
                    {[
                      { label: ta.greeting, value: profile.identity?.greeting },
                      { label: ta.signoff, value: profile.identity?.signoff },
                      { label: ta.pronoun, value: profile.identity?.pronoun },
                      { label: ta.companyDescriptor, value: profile.identity?.company_descriptor },
                    ].map((item) => (
                      <div className="agent-profile-identity-item" key={item.label}>
                        <span>{item.label}</span><p>{item.value || "-"}</p>
                      </div>
                    ))}
                  </div>
                  <div className="agent-profile-voice">
                    <span>{ta.voiceNotes}</span>
                    <p>{profile.voice_notes || "-"}</p>
                  </div>
                </section>

                <section className="agent-profile-section">
                  <div className="agent-profile-section-head">
                    <div className="agent-profile-section-title">
                      <span className="agent-profile-section-icon"><ShieldCheck size={17} /></span>
                      <div><h2>{copy.activeKnowledge}</h2><p>{copy.activeKnowledgeDesc}</p></div>
                    </div>
                    <span className="agent-profile-badge success">{approvedFacts.length} {copy.approved.toLowerCase()}</span>
                  </div>
                  <div className="agent-profile-section-body">
                    <div className="agent-profile-rules-grid">
                      <RuleSection kind="house_rule" icon={<ShieldCheck size={15} />} />
                      <RuleSection kind="fact" icon={<FileText size={15} />} />
                      <RuleSection kind="exemplar" icon={<MessageSquareText size={15} />} />
                    </div>
                  </div>
                </section>

                <section className="agent-profile-section">
                  <div className="agent-profile-section-head">
                    <div className="agent-profile-section-title">
                      <span className="agent-profile-section-icon"><History size={17} /></span>
                      <div><h2>{copy.learningHistory}</h2><p>{copy.learningHistoryDesc}</p></div>
                    </div>
                  </div>
                  <div className="agent-profile-section-body">
                    <div className="agent-profile-learning-metrics">
                      <div className="agent-profile-learning-metric">
                        <span>{ta.learningCorrectionRate}</span>
                        <strong>{Math.round(learningMetrics.correctionRate * 100)}%</strong>
                        <small>{copy.correctionRateDetail}</small>
                      </div>
                      <div className="agent-profile-learning-metric">
                        <span>{ta.learningMedianDistance}</span>
                        <strong>{Math.round(learningMetrics.medianEditDistance * 100)}%</strong>
                        <small>{copy.medianDetail}</small>
                      </div>
                      <div className="agent-profile-learning-metric">
                        <span>{ta.learningReviewed}</span>
                        <strong>{learningMetrics.reviewedDecisions}</strong>
                        <small>{copy.reviewedDetail}</small>
                      </div>
                    </div>

                    {learningEvents.length ? (
                      <div className="agent-profile-events">
                        {learningEvents.slice(0, 12).map((event) => (
                          <details className="agent-profile-event" key={event.id}>
                            <summary>
                              <div className="agent-profile-event-title">
                                <strong>{copy.classification[event.classification]} · {Math.round(event.edit_distance * 100)}% {copy.change}</strong>
                                <span>{copy.eventStatus[event.status]} · {Math.round(event.confidence * 100)}% {copy.confidence}</span>
                              </div>
                              <span className="agent-profile-event-date">{formatDate(event.processed_at, locale)}</span>
                              <ChevronDown size={15} />
                            </summary>
                            <div className="agent-profile-event-body">
                              <div className="agent-profile-comparison">
                                <div><span>{ta.learningAiDraft}</span><p>{event.normalized_ai}</p></div>
                                <div><span>{ta.learningHumanDraft}</span><p>{event.normalized_human}</p></div>
                              </div>
                              {event.normalized_diff?.removed?.length || event.normalized_diff?.added?.length ? (
                                <div className="agent-profile-diff">
                                  {event.normalized_diff.removed?.length ? <p className="removed"><strong>{ta.learningRemoved}:</strong> {event.normalized_diff.removed.join(" ")}</p> : null}
                                  {event.normalized_diff.added?.length ? <p className="added"><strong>{ta.learningAdded}:</strong> {event.normalized_diff.added.join(" ")}</p> : null}
                                </div>
                              ) : null}
                              {event.candidate_rule ? (
                                <div className="agent-profile-notice success">
                                  <Sparkles size={15} /><div><strong>{copy.proposedLesson}</strong><p>{event.candidate_rule}</p></div>
                                </div>
                              ) : null}
                              <div className="agent-profile-source">
                                <span>{copy.eventStatus[event.status]}</span>
                                {event.conversation_id ? <Link href={`/inbox/${event.conversation_id}`}><MessageSquareText size={12} /> {copy.sourceReply}</Link> : null}
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <div className="agent-profile-empty" style={{ minHeight: 120 }}>
                        <span className="agent-profile-empty-icon"><History size={18} /></span>
                        <p>{copy.noLearning}</p>
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : null}
          </div>
        )}
      </main>
    </>
  );
}
