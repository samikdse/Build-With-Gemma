/**
 * Server-side hosted Gemma client. Runs ONLY inside Vercel serverless
 * functions — the API key never reaches the browser and is never logged.
 *
 * Supports the two shapes a hosted Gemma key is normally issued for:
 *  - Google AI Studio / Generative Language API  (default)
 *  - Any OpenAI-compatible /chat/completions endpoint
 * Detected from GEMMA_API_BASE_URL so one key works either way.
 */

const DEFAULT_BASE = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemma-3-27b-it";

export interface HostedConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  visionModel: string;
}

export function readConfig(): HostedConfig | null {
  const apiKey = process.env.GEMMA_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (process.env.GEMMA_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.GEMMA_MODEL || DEFAULT_MODEL;
  return {
    apiKey,
    baseUrl,
    model,
    visionModel: process.env.GEMMA_VISION_MODEL || model,
  };
}

const isGoogle = (baseUrl: string) => /generativelanguage|googleapis/.test(baseUrl);

export interface CallArgs {
  /** Combined instruction + input. Gemma on AI Studio has no system role. */
  prompt: string;
  /** Raw base64 image payload (no data: prefix). */
  imageBase64?: string;
  imageMimeType?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export class HostedError extends Error {
  constructor(
    message: string,
    public readonly kind: "no_key" | "timeout" | "http" | "bad_output",
  ) {
    super(message);
  }
}

/** Never let a provider error string carry the key into a log or response. */
function scrub(text: string, key: string): string {
  return key ? text.split(key).join("[redacted]") : text;
}

async function once(cfg: HostedConfig, args: CallArgs, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let url: string;
    let body: unknown;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (isGoogle(cfg.baseUrl)) {
      const model = args.imageBase64 ? cfg.visionModel : cfg.model;
      url = `${cfg.baseUrl}/v1beta/models/${model}:generateContent`;
      headers["x-goog-api-key"] = cfg.apiKey; // header, not query string
      const parts: unknown[] = [{ text: args.prompt }];
      if (args.imageBase64) {
        parts.push({
          inline_data: {
            mime_type: args.imageMimeType || "image/jpeg",
            data: args.imageBase64,
          },
        });
      }
      body = {
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: args.temperature ?? 0.1,
          maxOutputTokens: args.maxTokens ?? 2048,
          responseMimeType: "application/json",
        },
      };
    } else {
      // OpenAI-compatible
      url = `${cfg.baseUrl}/chat/completions`;
      headers.Authorization = `Bearer ${cfg.apiKey}`;
      const content: unknown[] = [{ type: "text", text: args.prompt }];
      if (args.imageBase64) {
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${args.imageMimeType || "image/jpeg"};base64,${args.imageBase64}`,
          },
        });
      }
      body = {
        model: args.imageBase64 ? cfg.visionModel : cfg.model,
        messages: [{ role: "user", content }],
        temperature: args.temperature ?? 0.1,
        max_tokens: args.maxTokens ?? 2048,
        response_format: { type: "json_object" },
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const detail = scrub((await res.text()).slice(0, 300), cfg.apiKey);
      throw new HostedError(`Gemma API returned ${res.status}: ${detail}`, "http");
    }

    const data = (await res.json()) as Record<string, any>;
    const text: string | undefined = isGoogle(cfg.baseUrl)
      ? data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("")
      : data?.choices?.[0]?.message?.content;

    if (!text) throw new HostedError("Gemma API returned an empty response", "bad_output");
    return text;
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new HostedError(`Gemma API timed out after ${Math.round(timeoutMs / 1000)}s`, "timeout");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** One call, at most one controlled retry, hard timeout. */
export async function callGemma(cfg: HostedConfig, args: CallArgs): Promise<string> {
  const timeoutMs = args.timeoutMs ?? 25_000;
  try {
    return await once(cfg, args, timeoutMs);
  } catch (e) {
    const kind = e instanceof HostedError ? e.kind : "http";
    // retry once for transient failures only
    if (kind === "timeout" || kind === "http" || kind === "bad_output") {
      return await once(cfg, args, timeoutMs);
    }
    throw e;
  }
}

/** Pull the first JSON object out of possibly-noisy model text. */
export function extractJSON(text: string): any {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
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
  throw new HostedError("Gemma returned malformed JSON", "bad_output");
}

/** Uniform error body — safe to send to the browser. */
export function errorBody(e: unknown, apiKey = "") {
  const msg = e instanceof Error ? scrub(e.message, apiKey) : "Unexpected error";
  return { ok: false as const, error: msg };
}
