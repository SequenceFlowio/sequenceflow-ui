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
    welcome:   "Welkom",
    logout:    "Uitloggen",
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

    bolTitle: "Bol.com",
    bolDesc:  "Synchroniseer automatisch Bol.com-verkopersberichten en besteltickets naar uw SupportFlow-inbox.",

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

  autosend: {
    title:       "Auto-verzenden",
    badge:       "PRO",
    description: "Verstuur AI-antwoorden automatisch op twee vaste tijden per dag. Alleen antwoorden boven je vertrouwensdrempel worden verzonden — de rest blijft in je inbox ter controle.",
    enableLabel: "Auto-verzenden inschakelen",
    enableDesc:  "Wanneer ingeschakeld worden hoog-vertrouwen concepten in de wachtrij geplaatst en op de onderstaande tijden verstuurd. Controleer je inbox voor elk venster als je iets wilt annuleren.",
    thresholdLabel: "Minimaal vertrouwen voor auto-verzenden",
    thresholdDesc:  "Antwoorden onder dit niveau worden altijd ter handmatige controle bewaard.",
    time1Label:  "Eerste verzendtijd (UTC)",
    time2Label:  "Tweede verzendtijd (UTC)",
    lockedText:  "Auto-verzenden is beschikbaar vanaf het Pro plan. Upgrade om je inbox zichzelf te laten runnen.",
    upgradeCta:  "Upgrade naar Pro →",
    howItWorks:  "Hoe het werkt",
    step1: "De AI genereert een concept voor elk inkomend e-mail.",
    step2: "Concepten boven je vertrouwensdrempel worden als "in wachtrij" gezet.",
    step3: "Op je twee dagelijkse verzendtijden worden alle wachtende concepten automatisch verstuurd.",
    step4: "Automatisch verstuurde antwoorden verschijnen in je Verzonden-tab met een "auto" badge.",
    step5: "Je kunt elk wachtend concept annuleren vanuit je inbox voordat het verstuurd wordt.",
    pendingSendAt:   "Verstuurt om",
    pendingSendSoon: "Wordt binnenkort verstuurd",
    cancelAutosend:  "Annuleren",
    cancelledToast:  "Auto-verzenden geannuleerd — concept terug in inbox.",
  },

  analytics: {
    title:    "Analytics",
    subtitle: "Inzichten over de prestaties van je AI-assistent — afgelopen 30 dagen.",
    subtitleLocked: "Inzichten over de prestaties van je AI-assistent.",
    loadError: "Kon analytics niet laden.",

    lockedText: "Volledige analytics zijn beschikbaar vanaf het Pro plan. Upgrade om inzichten te zien over je AI-prestaties.",
    upgradeCta: "Upgrade naar Pro →",

    noDataTitle: "Nog geen data beschikbaar",
    noDataDesc:  "Analytics worden gevuld zodra emails verwerkt zijn via de cron. Zorg dat Gmail gekoppeld is en de cron actief is.",

    kpiEmailsProcessed:    "Emails verwerkt",
    kpiEmailsSub:          "afgelopen 30 dagen",
    kpiAutoResolved:       "Auto-opgelost",
    kpiAutoResolvedSub:    "zonder menselijke hulp",
    kpiAvgConfidence:      "Gem. vertrouwen",
    kpiAvgConfidenceSub:   "AI-zekerheid",
    kpiAvgLatency:         "Gem. responstijd",
    kpiAvgLatencySub:      "per verwerking",

    volumeTitle:     "E-mailvolume — afgelopen 30 dagen",
    volumeNoData:    "Nog geen data beschikbaar.",
    areaAuto:        "Auto",
    areaHumanReview: "Human review",

    autoResolveTrendTitle:   "Auto-oplossings trend",
    autoResolveTrendSub:     "% emails per dag automatisch opgelost zonder menselijke tussenkomst",
    autoResolveTrendNoData:  "Nog geen data beschikbaar.",
    autoResolvedLabel:       "Auto-opgelost",

    topIntentsTitle:  "Top intents",
    topIntentsNoData: "Nog geen data beschikbaar.",
    emailsLabel:      "Emails",

    aiHealthTitle:   "AI-gezondheid",
    aiHealthAllGood: "Geen problemen gevonden. Je AI presteert goed op alle intents.",
    aiHealthFix:     "Oplossen →",

    painPointsTitle:          "Klantpijnpunten",
    painPointsAnalyzedAt:     "Geanalyseerd:",
    painPointsRefreshing:     "Analyseren…",
    painPointsReanalyze:      "Opnieuw analyseren",
    painPointsLockedTitle:    "Klantpijnpunten",
    painPointsLockedText:     "AI-analyse van je meest voorkomende klantproblemen. Beschikbaar vanaf Pro.",
    painPointsInsufficientData: "Nog niet genoeg data — je hebt minimaal 5 tickets nodig voor een analyse.",
    aiBriefingLabel:          "✦ AI Briefing",
    ticketsLabel:             "tickets",

    timeAgoJustNow: "zojuist",
    timeAgoMinutes: "min geleden",
    timeAgoHours:   "uur geleden",
    timeAgoDays:    "dagen geleden",
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
