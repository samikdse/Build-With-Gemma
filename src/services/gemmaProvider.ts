import type { AnalysisProgress, AnalysisProvider, AnalysisResult, UploadInput } from "./provider";
import type { AnalyzedDocument, AskAnswer, LanguageCode } from "../types";

/**
 * Live Gemma provider — NEXT PHASE. Same interface as FixtureProvider,
 * so wiring it in is a one-line swap in services/index.ts.
 *
 * Planned integration (see README "Live Gemma integration order"):
 *  1. Document Agent   — Gemma 3 multimodal: image/PDF text -> structured
 *     JSON facts, constrained with a JSON schema (Ollama `format`).
 *  2. Verification     — every generated claim re-checked against source
 *     segments; uncited claims stripped server-side.
 *  3. Ask              — EmbeddingGemma retrieval over segments + grounded
 *     answering with mandatory citations and a NOT_FOUND sentinel.
 *  4. Translation + Plain-Language agents.
 *  5. Coverage + Action agents (tool call: create_reminder).
 *
 * Env (see .env.example): VITE_GEMMA_BASE_URL, VITE_GEMMA_MODEL.
 */
export class GemmaProvider implements AnalysisProvider {
  readonly mode = "gemma" as const;

  constructor(
    private baseUrl: string = import.meta.env.VITE_GEMMA_BASE_URL ?? "http://localhost:11434/v1",
    private model: string = import.meta.env.VITE_GEMMA_MODEL ?? "gemma3:4b",
  ) {}

  analyze(
    _input: UploadInput,
    _targetLanguage: LanguageCode,
    _onProgress: (p: AnalysisProgress) => void,
  ): Promise<AnalysisResult> {
    throw new Error(
      `GemmaProvider not wired yet (${this.model} @ ${this.baseUrl}). Use fixtureProvider.`,
    );
  }

  ask(_question: string, _documents: AnalyzedDocument[]): Promise<AskAnswer> {
    throw new Error("GemmaProvider not wired yet. Use fixtureProvider.");
  }
}
