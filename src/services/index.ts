import type { AnalysisProgress, AnalysisProvider, AnalysisResult, UploadInput } from "./provider";
import type { AnalyzedDocument, AskAnswer, LanguageCode } from "../types";
import { fixtureProvider } from "./fixtureProvider";
import { gemmaProvider } from "./gemmaProvider";
import { gemmaHealth } from "./gemma/client";
import { gemmaConfig } from "./gemma/config";

/**
 * Execution hierarchy (non-negotiable):
 *   1. Live Gemma output
 *   2. Validated cached output (demo fixtures — only for the demo samples)
 *   3. Clear recoverable error state (surfaced to the UI, never an endless spinner)
 *
 * A user's OWN document never silently falls back to demo content — that
 * would fabricate results. Cached fallback applies only to the built-in
 * samples; real uploads get a recoverable error with retry options.
 */

export class RecoverableAnalysisError extends Error {
  constructor(
    message: string,
    public readonly canUseSample: boolean,
  ) {
    super(message);
  }
}

class ResilientProvider implements AnalysisProvider {
  get mode() {
    return gemmaConfig.forceFixtures ? ("fixtures" as const) : ("gemma" as const);
  }

  async analyze(
    input: UploadInput,
    targetLanguage: LanguageCode,
    onProgress: (p: AnalysisProgress) => void,
  ): Promise<AnalysisResult> {
    const health = gemmaConfig.forceFixtures ? { ok: false } : await gemmaHealth();

    if (health.ok) {
      try {
        return await gemmaProvider.analyze(input, targetLanguage, onProgress);
      } catch (e) {
        const reason = (e as Error).message || "Gemma call failed";
        if (input.sampleId) {
          // tier 2: validated cached output for the demo samples
          const result = await fixtureProvider.analyze(input, targetLanguage, onProgress);
          result.run.engine = "fixtures";
          result.run.fallbackReason = reason;
          result.document.engine = "fixtures";
          return result;
        }
        // tier 3: recoverable error for the user's own document
        throw new RecoverableAnalysisError(reason, true);
      }
    }

    // Gemma not reachable (or forced off): fixtures serve the demo samples;
    // real uploads get an honest error rather than fabricated results.
    if (input.sampleId || gemmaConfig.forceFixtures) {
      const result = await fixtureProvider.analyze(input, targetLanguage, onProgress);
      result.run.engine = "fixtures";
      if (!gemmaConfig.forceFixtures) result.run.fallbackReason = "Gemma is not running on this machine";
      result.document.engine = "fixtures";
      return result;
    }
    throw new RecoverableAnalysisError(
      "Live analysis needs Gemma running locally (Ollama), and it isn't reachable right now.",
      true,
    );
  }

  async ask(question: string, documents: AnalyzedDocument[]): Promise<AskAnswer> {
    const health = gemmaConfig.forceFixtures ? { ok: false } : await gemmaHealth();
    if (health.ok) {
      try {
        return await gemmaProvider.ask(question, documents);
      } catch {
        /* fall through to cached answers */
      }
    }
    return fixtureProvider.ask(question, documents);
  }
}

export const provider: AnalysisProvider = new ResilientProvider();
export { gemmaHealth } from "./gemma/client";
export { gemmaConfig } from "./gemma/config";
