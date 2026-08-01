import type { AnalysisProgress, AnalysisProvider, AnalysisResult, UploadInput } from "./provider";
import type { AnalyzedDocument, AskAnswer, LanguageCode } from "../types";
import { fixtureProvider } from "./fixtureProvider";
import { hostedProvider, HostedUploadError } from "./hostedProvider";

/**
 * Production execution hierarchy:
 *   1. Hosted Gemma API (via our own /api routes — key stays server-side)
 *   2. Validated fixture fallback (built-in demo samples only)
 *   3. Clear recoverable error (never an endless spinner)
 *
 * A user's OWN document never silently falls back to demo content — that
 * would fabricate results. Cached fallback applies only to built-in samples.
 *
 * Ollama is NOT used in production. It remains available for local dev via
 * the local GemmaProvider, which is no longer wired into this chain.
 */

export class RecoverableAnalysisError extends Error {
  constructor(
    message: string,
    public readonly canUseSample: boolean,
  ) {
    super(message);
  }
}

let hostedAvailable: boolean | null = null;
let hostedModel: string | null = null;

/** Is the hosted API configured? Cached after the first check. */
export async function hostedHealth(): Promise<{ hosted: boolean; model: string | null }> {
  if (hostedAvailable !== null) return { hosted: hostedAvailable, model: hostedModel };
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("bad status");
    const data = (await res.json()) as { hosted?: boolean; model?: string | null };
    hostedAvailable = Boolean(data.hosted);
    hostedModel = data.model ?? null;
  } catch {
    hostedAvailable = false;
    hostedModel = null;
  }
  return { hosted: hostedAvailable, model: hostedModel };
}

class ResilientProvider implements AnalysisProvider {
  get mode() {
    return hostedAvailable ? ("gemma" as const) : ("fixtures" as const);
  }

  async analyze(
    input: UploadInput,
    targetLanguage: LanguageCode,
    onProgress: (p: AnalysisProgress) => void,
  ): Promise<AnalysisResult> {
    const { hosted } = await hostedHealth();

    if (hosted) {
      try {
        return await hostedProvider.analyze(input, targetLanguage, onProgress);
      } catch (e) {
        // A bad/oversized upload is the user's to fix — say so, don't fake it.
        if (e instanceof HostedUploadError) throw new RecoverableAnalysisError(e.message, true);

        const reason = (e as Error).message || "Hosted Gemma request failed";
        if (input.sampleId) {
          const result = await fixtureProvider.analyze(input, targetLanguage, onProgress);
          result.run.engine = "fixtures";
          result.run.fallbackReason = reason;
          result.document.engine = "fixtures";
          return result;
        }
        throw new RecoverableAnalysisError(reason, true);
      }
    }

    // Hosted not configured: samples still work from the validated cache.
    if (input.sampleId) {
      const result = await fixtureProvider.analyze(input, targetLanguage, onProgress);
      result.run.engine = "fixtures";
      result.document.engine = "fixtures";
      return result;
    }
    throw new RecoverableAnalysisError(
      "Live analysis isn't available right now. You can still try a built-in sample.",
      true,
    );
  }

  async ask(question: string, documents: AnalyzedDocument[]): Promise<AskAnswer> {
    const { hosted } = await hostedHealth();
    if (hosted) {
      try {
        return await hostedProvider.ask(question, documents);
      } catch {
        /* fall through to the cached answers */
      }
    }
    return fixtureProvider.ask(question, documents);
  }
}

export const provider: AnalysisProvider = new ResilientProvider();
