// kie.ai: tekst (Gemini Flash, OpenAI-compatibel) en backup-beelden (Nano Banana 2.1).
const KIE_BASE_URL = "https://api.kie.ai";

export function kieConfigured() {
  return Boolean(process.env.KIE_API_KEY);
}

async function kieFetch(path: string, init?: RequestInit) {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("kie.ai is nog niet gekoppeld");
  const response = await fetch(`${KIE_BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const raw = await response.text();
  let data: Record<string, unknown>;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Ongeldig antwoord van kie.ai (${response.status})`);
  }
  // kie.ai geeft soms HTTP 200 met een foutcode in de body
  const code = typeof data.code === "number" ? data.code : response.status;
  if (!response.ok || (code !== 200 && "code" in data)) {
    throw new Error(String(data.msg ?? (data.error as { message?: string })?.message ?? `kie.ai request mislukt (${code})`));
  }
  return data;
}

/**
 * Gestructureerde output via Gemini Flash (OpenAI-compatibel endpoint van kie.ai).
 * Stabiel en goedkoop; het model zit in het URL-pad.
 */
export async function kieStructured<T>({ system, prompt, toolName, schema }: {
  system: string;
  prompt: string;
  toolName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const model = process.env.KIE_TEXT_MODEL || "gemini-3-8-flash-openai";
  const data = await kieFetch(`/${model}/v1/chat/completions`, {
    method: "POST",
    body: JSON.stringify({
      messages: [
        { role: "system", content: [{ type: "text", text: system }] },
        { role: "user", content: [{ type: "text", text: prompt }] },
      ],
      stream: false,
      include_thoughts: false,
      reasoning_effort: "low",
      response_format: { type: "json_schema", json_schema: { name: toolName, schema } },
    }),
  });
  const choices = (data.choices ?? []) as Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  const content = choices[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("kie.ai gaf geen bruikbare JSON terug");
  return JSON.parse(match[0]) as T;
}

export async function getKieCredits() {
  const data = await kieFetch("/api/v1/chat/credit");
  return Number(data.data ?? 0);
}

export async function createKieImage(prompt: string) {
  const data = await kieFetch("/api/v1/jobs/createTask", {
    method: "POST",
    body: JSON.stringify({
      model: "nano-banana-2-1",
      input: { prompt, aspect_ratio: "3:4", resolution: "2K", output_format: "png" },
    }),
  });
  const taskId = (data.data as { taskId?: string })?.taskId;
  if (!taskId) throw new Error("kie.ai gaf geen task-ID terug");
  return taskId;
}

export async function getKieTask(taskId: string) {
  const data = await kieFetch(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);
  const record = data.data as { state: string; resultJson?: string; failMsg?: string };
  const state = record?.state;
  if (state === "success") {
    const result = record.resultJson ? JSON.parse(record.resultJson) as { resultUrls?: string[] } : {};
    return { status: "completed" as const, urls: result.resultUrls ?? [] };
  }
  if (state === "fail") return { status: "failed" as const, urls: [], error: record.failMsg || "kie.ai-generatie mislukt" };
  return { status: "processing" as const, urls: [] };
}
