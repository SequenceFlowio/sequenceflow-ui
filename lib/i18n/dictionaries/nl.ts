import type { Dictionary } from "./en";

export const nl: Dictionary = {
  common: {
    save: "Configuratie opslaan",
    saving: "Opslaan...",
    saved: "Opgeslagen ✓",
    saveFailed: "Opslaan mislukt",
    upload: "Uploaden",
    uploading: "Uploaden…",
    cancel: "Annuleren",
    delete: "Verwijderen",
    reindex: "Herindexeren",
    loading: "Laden…",
    generating: "Genereren...",
    yesAllow: "Ja, toestaan",
    noDocuments: "Nog geen documenten. Upload er een hierboven.",
    titleOptional: "Titel (optioneel)",
    admin: "beheerder",
  },

  sidebar: {
    inbox:     "Inbox",
    knowledge: "Kennisbank",
    settings:  "Instellingen",
    analytics: "Analytics",
  },

  inbox: {
    title:         "Inbox",
    subtitle:      "AI-gegenereerde concepten ter beoordeling.",
    colSubject:    "Onderwerp",
    colCustomer:   "Klant",
    colIntent:     "Intentie",
    colConfidence: "Zekerheid",
    colStatus:     "Status",
    intentLabels: {
      order_status:   "bestelstatus",
      return_request: "retourverzoek",
      complaint:      "klacht",
      fallback:       "overig",
    },
    statusLabels: {
      "Draft Ready":  "Concept klaar",
      "Needs Review": "Beoordeling nodig",
      "Escalated":    "Geëscaleerd",
    },
  },

  ticketDetail: {
    backToInbox:      "← Inbox",
    customerMessage:  "Klantbericht",
    aiDraft:          "AI Concept",
    decisionPanel:    "Beslispaneel",
    intent:           "Intentie",
    confidence:       "Zekerheid",
    proposedDiscount: "Voorgestelde korting",
    policyCheck:      "Beleidscheck",
    escalationReason: "Escalatiereden",
    approveAndSend:   "Goedkeuren & Versturen",
    escalate:         "Escaleren",
    none:             "Geen",
  },

  settings: {
    title:    "Instellingen",
    subtitle: "Configureer uw werkruimte, integraties en team.",

    tabPolicy:       "Beleid",
    tabIntegrations: "Integraties",
    tabTeam:         "Team",

    allowDiscount:     "Korting toestaan",
    allowDiscountDesc: "Sta de AI toe kortingen voor te stellen in antwoorden.",
    maxDiscount:       "Maximale korting (€)",

    confidenceThreshold:     "Escalatiedrempel zekerheid",
    confidenceThresholdDesc: "Tickets onder deze score worden gemarkeerd voor handmatige beoordeling.",

    emailSignature: "E-mailhandtekening",
    save:           "Opslaan",

    gmailTitle: "Gmail",
    gmailDesc:  "Koppel uw Gmail-inbox om support-e-mails automatisch te verwerken via SupportFlow.",
    connectGmail: "Gmail koppelen",

    teamMembers:   "Teamleden",
    colName:       "Naam",
    colEmail:      "E-mail",
    colRole:       "Rol",
    noTeamMembers: "Nog geen teamleden.",
  },

  dashboard: {
    title: "Dashboard",
    subtitle: "Overzicht van uw SupportFlow OS.",
    customerQuestions: "Klantvragen",
    aiDraftsGenerated: "AI-concepten gegenereerd",
    aiAcceptanceRate: "AI-acceptatiepercentage",
    avgResponseTime: "Gem. responstijd",
    noQuestionsYet: "Nog geen vragen",
    noPreviousData: "Geen eerdere data",
    vsLastWeek: "vs afgelopen 7 dagen",
    workloadTitle: "AI-werklast bespaard",
    workloadSubtext: "Gebaseerd op geaccepteerde concepten",
    workloadSavedThisMonth: "bespaard deze maand",
    noActivityThisMonth: "Geen activiteit deze maand",
    chartTitle: "Vragen over tijd",
    activityTitle: "Recente activiteit",
    noActivityFeed: "Nog geen activiteit",
    noChartActivity: "Nog geen supportactiviteit",
  },

  knowledge: {
    title: "Kennisbank",
    subtitle:
      "Beheer documenten voor de supportagent. Beleid- en trainingsdocumenten zijn klantspecifiek; platformdocumenten zijn globaal.",
    subtitleClient:
      "Upload beleids- en trainingsdocumenten voor uw werkruimte.",
    tabPolicy: "Beleid",
    tabPolicyDesc: "Retourbeleid, garantieregels, verzendvoorwaarden.",
    tabTraining: "Training",
    tabTrainingDesc: "Q&A-paren en scripts voor agenttraining.",
    tabPlatform: "Platform",
    tabPlatformDesc:
      "Platformbrede documenten voor alle klanten (alleen beheerder).",
    status: {
      ready: "GEREED",
      processing: "VERWERKEN",
      pending: "WACHTEND",
      error: "FOUT",
    },
    dropzonePlaceholder: "Selecteer of sleep een bestand",
    selectFile: "Bestand selecteren",
    changeFile: "Bestand wijzigen",
  },

  agentConsole: {
    title: "Agent Console",
    subtitle:
      "Configureer de supportagent en genereer een live AI-voorbeeld.",
    enableEmpathy: "Empathie inschakelen",
    allowDiscount: "Korting toestaan",
    maxDiscount: "Geef maximale korting op (€)",
    signature: "Handtekening",
    generatePreview: "Voorbeeld genereren",
    aiPreview: "AI Voorbeeld",
    routing: "Routering",
    confidence: "Betrouwbaarheid",
    subject: "Onderwerp",
    body: "Bericht",
    emptyPreview:
      'Klik op "Voorbeeld genereren" voor een live AI-reactie op basis van de huidige configuratie.',
    modalTitle: "Kortingen toestaan?",
    modalText:
      "Weet u zeker dat u de AI wilt toestaan kortingen aan klanten aan te bieden?",
  },
};
