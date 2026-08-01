/**
 * Model configuration layer. Everything is overridable via env vars —
 * no hard-coded secrets, no hard-coded model names in call sites.
 *
 * Local Ollama needs no API key. If a hosted OpenAI-compatible endpoint is
 * used instead, its key goes in VITE_GEMMA_API_KEY (never committed).
 */
export interface GemmaConfig {
  baseUrl: string;
  chatModel: string; // multimodal Gemma for documents/images + all agents
  embedModel: string; // EmbeddingGemma for multilingual retrieval
  apiKey?: string;
  /** Per-call budget. CPU inference is slow — be generous but bounded. */
  timeoutMs: number;
  /** Force fixtures even if Gemma is reachable (demo safety switch). */
  forceFixtures: boolean;
}

/**
 * Engine selection.
 *
 * DEFAULT = validated demo cache. On CPU-only machines a full live pass takes
 * minutes, which is unusable for a recording, so the deterministic fixtures
 * drive the demo by default.
 *
 * The verified live Gemma pipeline is fully intact — opt in with:
 *   VITE_ENGINE=gemma npm run dev
 */

export const gemmaConfig: GemmaConfig = {
  baseUrl: (import.meta.env.VITE_GEMMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, ""),
  chatModel: import.meta.env.VITE_GEMMA_MODEL ?? "gemma3:4b",
  embedModel: import.meta.env.VITE_EMBED_MODEL ?? "embeddinggemma:300m",
  apiKey: import.meta.env.VITE_GEMMA_API_KEY || undefined,
  timeoutMs: Number(import.meta.env.VITE_GEMMA_TIMEOUT_MS ?? 180_000),
  forceFixtures: import.meta.env.VITE_ENGINE !== "gemma",
};
