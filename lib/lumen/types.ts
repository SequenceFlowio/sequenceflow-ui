export type LumenSourceStatus = "ready" | "empty" | "unavailable";

export type LumenSource = {
  id: string;
  label: string;
  detail: string;
  status: LumenSourceStatus;
  updatedAt?: string | null;
};

export type LumenSnapshot = {
  generatedAt: string;
  periodDays: 30;
  support: {
    conversations: number;
    sent: number;
    review: number;
    escalated: number;
    spam: number;
    autoSent: number;
    averageConfidence: number | null;
    confidenceSampleSize: number;
    topIntents: Array<{ intent: string; count: number }>;
  } | null;
  painPoints: {
    intro: string;
    ticketCount: number;
    items: Array<{
      category: string;
      count: number;
      percentage: number;
      description: string;
      recommendedAction: string;
    }>;
  } | null;
  commerce: {
    connected: boolean;
    connectionStatus: string | null;
    orders: number;
    openOrders: number;
    products: number;
    lowStock: number;
    activeReturns: number;
    shipmentsWithoutTransportEvent: number;
    coverage: Record<string, unknown> | null;
    summary: string | null;
    signals: Array<{
      id: string;
      severity: string;
      title: string;
      finding: string;
      recommendedAction: string;
      sample: number;
    }>;
    topProducts: Array<{
      title: string;
      orderedUnits: number;
      returnedUnits: number;
      stock: number | null;
    }>;
  } | null;
  knowledge: {
    ready: number;
    processing: number;
    attention: number;
    categories: Array<{ category: string; count: number }>;
  } | null;
  agentProfile: {
    active: boolean;
    approvedFacts: number;
    proposedFacts: number;
    approvedByKind: Array<{ kind: string; count: number }>;
  } | null;
  sources: LumenSource[];
  suggestions: string[];
};

export type LumenChatMessage = {
  role: "user" | "assistant";
  content: string;
};
