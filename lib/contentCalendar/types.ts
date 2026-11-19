export type PostStatus = "review" | "approved" | "rejected" | "posted";
export type ImageStatus = "none" | "generating" | "ready" | "failed";
export type ImageProvider = "genai" | "kie";
export type Template = "photo" | "card";
export type Visual = "photo" | "ui"; // sfeerfoto of SaaS-interfacebeeld

export interface Slide {
  title: string;
  body: string;
}

export interface PostImage {
  status: ImageStatus;
  provider?: ImageProvider;
  taskId?: string;
  prompt?: string;
  files: string[]; // bestandsnamen in data/media
  selected: number;
  error?: string;
  fallbackReason?: string; // waarom kie.ai i.p.v. GenAI Pro
  startedAt?: string;
}

/** Reel: video en cover in de privé-bucket, Instagram haalt ze op via een tijdelijke link. */
export interface PostVideo {
  file: string; // .mp4 in de bucket
  cover?: string; // .jpg in de bucket
}

export interface Post {
  id: string;
  locale?: "nl" | "en"; // ontbreekt = nl; datum en tijd zijn lokale tijd van die taal (locale.ts)
  sourceId?: string; // Engelse versie: id van de Nederlandse post waar hij van vertaald is
  needsEnglishImage?: boolean; // Engelse versie met een Nederlands interfacebeeld: nog een Engels beeld maken
  englishSkip?: string;
  external?: { source: "instagram"; permalink?: string; thumbnail?: string }; // zelf op Instagram geplaatst, niet via de kalender; alleen om te meten // Nederlandse post die niet naar Engels gaat (alleen relevant voor NL/EU), met de reden
  kind?: "carousel" | "reel" | "story"; // ontbreekt bij oude posts = carousel; story = alleen Instagram
  video?: PostVideo;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  pillar: string;
  format?: string; // contentformat (brand.ts FORMATS); ontbreekt bij oude posts = tips
  factId?: string; // bij regels/platform/seizoen: welk feit uit NEWS (zodat het niet steeds terugkomt)
  visual?: Visual; // ontbreekt bij oude posts = photo
  template: Template;
  headline: string;
  subline: string;
  slides: Slide[];
  caption: string;
  hashtags: string[];
  scene: string;
  image: PostImage;
  status: PostStatus;
  feedback?: string;
  publish?: PostPublish;
  metrics?: PostMetrics;
  createdAt: string;
  updatedAt: string;
}

/** Wat de tekstgenerator per post oplevert. */
export interface PostDraft {
  pillar: string;
  format: string;
  factId?: string;
  visual?: Visual;
  template: Template;
  headline: string;
  subline: string;
  slides: Slide[];
  caption: string;
  hashtags: string[];
  scene: string;
}

/** Bulk-generatie: posts worden één voor één (in kleine groepjes) gemaakt. */
export interface Queue {
  id: string;
  status: "running" | "done" | "stopped";
  slots: Array<{ date: string; time: string }>; // nog te maken
  total: number;
  done: number;
  createdAt: string;
  lastError?: string;
  pausedUntil?: string;
}

/** Publicatie naar Instagram/Facebook (via de cron, zodra de post goedgekeurd en aan de beurt is). */
export interface PostPublish {
  instagram?: { id: string; at: string };
  /** Reel-container die Instagram nog verwerkt; volgende poging publiceert hem zonder opnieuw te uploaden. */
  instagramContainer?: { id: string; at: string };
  facebook?: { id: string; at: string };
  /** TikTok werkt asynchroon: eerst verstuurd (processing), daarna inbox (concept), published of failed. */
  tiktok?: { id: string; at: string; status: "processing" | "inbox" | "published" | "failed"; error?: string; attempts?: number };
  error?: string;
  attempts?: number;
  lastAttemptAt?: string;
}

/** Cijfers van één meetmoment na publicatie (Instagram, plus Facebook waar beschikbaar). */
export interface MetricSnapshot {
  at: string;
  ageHours: number;
  reach?: number;
  views?: number;
  likes: number;
  comments: number;
  shares?: number;
  saves?: number;
  follows?: number;
  profileVisits?: number;
  fbReactions?: number;
  fbComments?: number;
  fbShares?: number;
}

export type SnapshotKey = "24h" | "72h" | "7d";
export type PerformanceLabel = "viral" | "boven" | "gemiddeld" | "onder";

export interface PostMetrics {
  snapshots: Partial<Record<SnapshotKey, MetricSnapshot>>;
  latest?: MetricSnapshot;
  insights: "full" | "basic"; // basic = alleen likes en reacties (recht instagram_manage_insights ontbreekt)
  lastCheckedAt: string;
  score?: number; // 1 = gemiddeld voor dit account
  label?: PerformanceLabel;
  error?: string;
}
