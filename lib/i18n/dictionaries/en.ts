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
