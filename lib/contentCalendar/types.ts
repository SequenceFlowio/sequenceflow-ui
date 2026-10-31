export type PostStatus = "review" | "approved" | "rejected" | "posted";
export type ImageStatus = "none" | "generating" | "ready" | "failed";
export type ImageProvider = "genai" | "kie";
export type Template = "photo" | "card";

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

export interface Post {
  id: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  pillar: string;
  format?: string; // contentformat (brand.ts FORMATS); ontbreekt bij oude posts = tips
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
  createdAt: string;
  updatedAt: string;
}

/** Wat de tekstgenerator per post oplevert. */
export interface PostDraft {
  pillar: string;
  format: string;
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
  facebook?: { id: string; at: string };
  error?: string;
  attempts?: number;
  lastAttemptAt?: string;
}
