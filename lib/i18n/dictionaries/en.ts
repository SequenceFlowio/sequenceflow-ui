export const en = {
  common: {
    save: "Save Config",
    saving: "Saving...",
    saved: "Saved ✓",
    saveFailed: "Save failed",
    upload: "Upload",
    uploading: "Uploading…",
    cancel: "Cancel",
    delete: "Delete",
    reindex: "Reindex",
    loading: "Loading…",
    generating: "Generating...",
    yesAllow: "Yes, allow",
    noDocuments: "No documents yet. Upload one above.",
    titleOptional: "Title (optional)",
    admin: "admin",
  },

  sidebar: {
    inbox:     "Inbox",
    knowledge: "Knowledge",
    settings:  "Settings",
    analytics: "Analytics",
    welcome:   "Welcome",
    logout:    "Log out",
  },

  inbox: {
    title:       "Inbox",
    subtitle:    "AI-generated drafts pending your review.",
    colSubject:  "Subject",
    colCustomer: "Customer",
    colIntent:   "Intent",
    colConfidence: "Confidence",
    colStatus:   "Status",
    intentLabels: {
      order_status:   "order status",
      return_request: "return request",
      complaint:      "complaint",
      fallback:       "fallback",
    },
    statusLabels: {
      "Draft Ready":  "Draft Ready",
      "Needs Review": "Needs Review",
      "Escalated":    "Escalated",
    },
  },

  ticketDetail: {
    backToInbox:      "← Inbox",
    customerMessage:  "Customer Message",
    aiDraft:          "AI Draft",
    decisionPanel:    "Decision Panel",
    intent:           "Intent",
    confidence:       "Confidence",
    proposedDiscount: "Proposed Discount",
    policyCheck:      "Policy Check",
    escalationReason: "Escalation Reason",
    approveAndSend:   "Approve & Send",
    escalate:         "Escalate",
    none:             "None",
  },

  settings: {
    title:    "Settings",
    subtitle: "Configure your workspace, integrations, and team.",

    tabPolicy:       "Policy",
    tabIntegrations: "Integrations",
    tabTeam:         "Team",

    allowDiscount:     "Allow Discount",
    allowDiscountDesc: "Permit the AI to propose discounts in replies.",
    maxDiscount:       "Max Discount (€)",

    confidenceThreshold:     "Confidence Escalation Threshold",
    confidenceThresholdDesc: "Tickets below this score are flagged for human review.",

    emailSignature: "Email Signature",
    save:           "Save",

    gmailTitle: "Gmail",
    gmailDesc:  "Connect your Gmail inbox to process support emails automatically via SupportFlow.",
    connectGmail: "Connect Gmail",

    bolTitle: "Bol.com",
    bolDesc:  "Automatically sync Bol.com seller messages and order tickets into your SupportFlow inbox.",

    teamMembers:    "Team Members",
    colName:        "Name",
    colEmail:       "Email",
    colRole:        "Role",
    noTeamMembers:  "No team members yet.",
  },

  dashboard: {
    title: "Dashboard",
    subtitle: "Overview of your SupportFlow OS.",
    customerQuestions: "Customer Questions",
    aiDraftsGenerated: "AI Drafts Generated",
    aiAcceptanceRate: "AI Acceptance Rate",
    avgResponseTime: "Avg Response Time",
    noQuestionsYet: "No questions yet",
    noPreviousData: "No previous data",
    vsLastWeek: "vs last 7 days",
    workloadTitle: "AI Workload Saved",
    workloadSubtext: "Based on accepted drafts",
    workloadSavedThisMonth: "saved this month",
    noActivityThisMonth: "No activity this month",
    chartTitle: "Questions Over Time",
    activityTitle: "Recent Activity",
    noActivityFeed: "No activity yet",
    noChartActivity: "No support activity yet",
  },

  knowledge: {
    title: "Knowledge Library",
    subtitle:
      "Manage documents used by the support agent. Policy and training docs are client-specific; platform docs are global.",
    subtitleClient:
      "Upload policy and training documents for your workspace.",
    tabPolicy: "Policy",
    tabPolicyDesc: "Return policies, warranty rules, shipping terms.",
    tabTraining: "Training",
    tabTrainingDesc: "Q&A pairs and scripts for agent training.",
    tabPlatform: "Platform",
    tabPlatformDesc:
      "Platform-wide docs visible to all clients (admin only).",
    status: {
      ready: "READY",
      processing: "PROCESSING",
      pending: "PENDING",
      error: "ERROR",
    },
    dropzonePlaceholder: "Select or drag a file here",
    selectFile: "Select file",
    changeFile: "Change file",
  },

  analytics: {
    title:    "Analytics",
    subtitle: "Insights into your AI assistant's performance — last 30 days.",
    subtitleLocked: "Insights into your AI assistant's performance.",
    loadError: "Could not load analytics.",

    lockedText: "Full analytics are available from the Pro plan. Upgrade to see insights about your AI performance.",
    upgradeCta: "Upgrade to Pro →",

    noDataTitle: "No data available yet",
    noDataDesc:  "Analytics will populate once emails have been processed via the cron. Make sure Gmail is connected and the cron is active.",

    kpiEmailsProcessed:    "Emails processed",
    kpiEmailsSub:          "last 30 days",
    kpiAutoResolved:       "Auto-resolved",
    kpiAutoResolvedSub:    "without human help",
    kpiAvgConfidence:      "Avg. confidence",
    kpiAvgConfidenceSub:   "AI certainty",
    kpiAvgLatency:         "Avg. response time",
    kpiAvgLatencySub:      "per processing",

    volumeTitle:     "Email volume — last 30 days",
    volumeNoData:    "No data available yet.",
    areaAuto:        "Auto",
    areaHumanReview: "Human review",

    autoResolveTrendTitle:   "Auto-resolve trend",
    autoResolveTrendSub:     "% emails per day automatically resolved without human intervention",
    autoResolveTrendNoData:  "No data available yet.",
    autoResolvedLabel:       "Auto-resolved",

    topIntentsTitle:  "Top intents",
    topIntentsNoData: "No data available yet.",
    emailsLabel:      "Emails",

    aiHealthTitle:   "AI health",
    aiHealthAllGood: "No issues found. Your AI is performing well on all intents.",
    aiHealthFix:     "Fix →",

    painPointsTitle:          "Customer pain points",
    painPointsAnalyzedAt:     "Analyzed:",
    painPointsRefreshing:     "Analyzing…",
    painPointsReanalyze:      "Re-analyze",
    painPointsLockedTitle:    "Customer pain points",
    painPointsLockedText:     "AI analysis of your most common customer problems. Available from Pro.",
    painPointsInsufficientData: "Not enough data yet — you need at least 5 tickets for an analysis.",
    aiBriefingLabel:          "✦ AI Briefing",
    ticketsLabel:             "tickets",

    timeAgoJustNow: "just now",
    timeAgoMinutes: "min ago",
    timeAgoHours:   "hr ago",
    timeAgoDays:    "days ago",
  },

  agentConsole: {
    title: "Agent Console",
    subtitle:
      "Configure the support agent and generate a live AI preview.",
    enableEmpathy: "Enable empathy",
    allowDiscount: "Allow discount",
    maxDiscount: "Please specify max discount (€)",
    signature: "Signature",
    generatePreview: "Generate Preview",
    aiPreview: "AI Preview",
    routing: "Routing",
    confidence: "Confidence",
    subject: "Subject",
    body: "Body",
    emptyPreview:
      'Hit "Generate Preview" to see a live AI response using the current config.',
    modalTitle: "Allow Discounts?",
    modalText:
      "Are you sure you want to allow the AI to offer discounts to customers?",
  },
};

export type Dictionary = typeof en;
