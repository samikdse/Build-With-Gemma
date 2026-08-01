import { gemmaConfig } from "./config";

/**
 * Thin Ollama client: schema-constrained chat + embeddings + health.
 * Uses Ollama's native API (`/api/chat` with `format`, `/api/embed`).
 */

export class GemmaError extends Error {
  constructor(
    message: string,
    public readonly kind: "unreachable" | "timeout" | "bad_output" | "http",
  ) {
    super(message);
  }
}

interface ChatJSONArgs {
  system: string;
  user: string;
  /** Base64 image payloads WITHOUT the data: prefix (Ollama format). */
  images?: string[];
  /** JSON Schema — Ollama constrains decoding to it. */
  schema: object;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new GemmaError(`Gemma call exceeded ${Math.round(timeoutMs / 1000)}s`, "timeout");
    }
    throw new GemmaError("Gemma endpoint unreachable", "unreachable");
  } finally {
    clearTimeout(t);
  }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (gemmaConfig.apiKey) h.Authorization = `Bearer ${gemmaConfig.apiKey}`;
  return h;
}

/** Extract the first JSON object from possibly-noisy model text. */
export function extractJSON(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }
  throw new GemmaError("Model returned malformed JSON", "bad_output");
}

export async function chatJSON(args: ChatJSONArgs): Promise<unknown> {
  const body = {
    model: gemmaConfig.chatModel,
    stream: false,
    format: args.schema,
    options: {
      temperature: args.temperature ?? 0.1,
      num_predict: args.maxTokens ?? 1200,
    },
    messages: [
      { role: "system", content: args.system },
      {
        role: "user",
        content: args.user,
        ...(args.images && args.images.length > 0 ? { images: args.images } : {}),
      },
    ],
  };
  const res = await fetchWithTimeout(
    `${gemmaConfig.baseUrl}/api/chat`,
    { method: "POST", headers: headers(), body: JSON.stringify(body) },
    args.timeoutMs ?? gemmaConfig.timeoutMs,
  );
  if (!res.ok) {
    throw new GemmaError(`Gemma HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`, "http");
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return extractJSON(data.message?.content ?? "");
}

export async function embed(texts: string[], timeoutMs = 60_000): Promise<number[][]> {
  const res = await fetchWithTimeout(
    `${gemmaConfig.baseUrl}/api/embed`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model: gemmaConfig.embedModel, input: texts }),
    },
    timeoutMs,
  );
  if (!res.ok) throw new GemmaError(`Embed HTTP ${res.status}`, "http");
  const data = (await res.json()) as { embeddings?: number[][] };
  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new GemmaError("Embedding response malformed", "bad_output");
  }
  return data.embeddings;
}

let healthCache: { ok: boolean; at: number; models: string[] } | null = null;

/** Is Ollama reachable and are our models present? Cached for 15s. */
export async function gemmaHealth(): Promise<{ ok: boolean; models: string[] }> {
  if (healthCache && Date.now() - healthCache.at < 15_000) return healthCache;
  try {
    const res = await fetchWithTimeout(`${gemmaConfig.baseUrl}/api/tags`, { headers: headers() }, 3_000);
    if (!res.ok) throw new Error("bad status");
    const data = (await res.json()) as { models?: { name: string }[] };
    const models = (data.models ?? []).map((m) => m.name);
    const hasChat = models.some((m) => m.startsWith(gemmaConfig.chatModel.split(":")[0]));
    healthCache = { ok: hasChat, at: Date.now(), models };
  } catch {
    healthCache = { ok: false, at: Date.now(), models: [] };
  }
  return healthCache;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
