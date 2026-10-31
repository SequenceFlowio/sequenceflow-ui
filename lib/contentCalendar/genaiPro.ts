// Overgenomen uit de Noctis Content Studio (werkende koppeling), ingekort tot beelden.
const GENAI_BASE_URL = "https://genaipro.io/api";

export interface GenAiCreditPackage {
  quota: number;
  used: number;
  expires_at: string | null;
}

export interface GenAiTask {
  id: string;
  prompt: string;
  file_urls: string[];
  status: "processing" | "completed" | "failed";
  error?: string;
  created_at: string;
}

export function genAiConfigured() {
  return Boolean(process.env.GENAIPRO_API_TOKEN);
}

function token() {
  const value = process.env.GENAIPRO_API_TOKEN;
  if (!value) throw new Error("GenAI Pro is nog niet gekoppeld");
  return value;
}

async function genAiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${GENAI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...init?.headers,
    },
    cache: "no-store",
  });

  const raw = await response.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw || "Ongeldig antwoord van GenAI Pro" };
  }

  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data
      ? String((data as { error: unknown }).error)
      : `GenAI Pro request mislukt (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export async function getGenAiCredits() {
  return await genAiFetch("/v2/veo/credits") as GenAiCreditPackage[];
}

export async function getGenAiUser() {
  return await genAiFetch("/v2/me") as { id: string; username: string; balance: number };
}

export function summarizeCredits(packages: GenAiCreditPackage[], now = new Date()) {
  const nowMs = now.getTime();
  const active = packages.filter((item) => item.expires_at === null || new Date(item.expires_at).getTime() > nowMs);
  const quota = active.reduce((sum, item) => sum + item.quota, 0);
  const used = active.reduce((sum, item) => sum + item.used, 0);
  const remaining = active.reduce((sum, item) => sum + Math.max(0, item.quota - item.used), 0);
  const expiries = active.flatMap((item) => item.expires_at ? [new Date(item.expires_at).getTime()] : []);
  const expiresAt = expiries.length ? new Date(Math.max(...expiries)).toISOString() : null;
  const hoursRemaining = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 3_600_000)) : null;
  // Laatst verlopen pakket, om te tonen wanneer de credits op zijn gegaan
  const lastExpired = packages.flatMap((item) => item.expires_at && new Date(item.expires_at).getTime() <= nowMs ? [new Date(item.expires_at).getTime()] : []);
  const expiredAt = !active.length && lastExpired.length ? new Date(Math.max(...lastExpired)).toISOString() : null;
  return { active: active.length > 0 && remaining > 0, quota, used, remaining, expiresAt, hoursRemaining, expiredAt };
}

export async function createGenAiImage(input: {
  prompt: string;
  aspectRatio?: "square" | "portrait" | "landscape" | "portrait_3_4" | "landscape_4_3";
  model?: "nano_banana_pro" | "nano_banana_2" | "imagen_4";
  upscaleResolution?: "none" | "2k" | "4k";
  numberOfImages?: number;
}) {
  const aspectRatios = {
    square: "IMAGE_ASPECT_RATIO_SQUARE",
    portrait: "IMAGE_ASPECT_RATIO_PORTRAIT",
    landscape: "IMAGE_ASPECT_RATIO_LANDSCAPE",
    portrait_3_4: "IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR",
    landscape_4_3: "IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE",
  };
  const form = new FormData();
  form.set("prompt", input.prompt);
  // 1 credit levert tot 4 varianten: standaard 4 vragen zodat de beste gekozen kan worden
  form.set("number_of_images", String(input.numberOfImages ?? 4));
  form.set("model", input.model ?? "nano_banana_pro");
  form.set("aspect_ratio", aspectRatios[input.aspectRatio ?? "portrait_3_4"]);
  form.set("upscale_resolution", input.upscaleResolution ?? "2k");
  return await genAiFetch("/v2/veo/create-image", { method: "POST", body: form }) as GenAiTask;
}

export async function getGenAiTask(id: string) {
  return await genAiFetch(`/v2/veo/tasks/${encodeURIComponent(id)}`) as GenAiTask;
}

/** Status van de laatste 100 taken in één request (zuiniger dan per taak pollen). */
export async function getGenAiHistories() {
  const data = await genAiFetch("/v2/veo/histories?page=1&page_size=100") as { data?: GenAiTask[] };
  return data.data ?? [];
}
