import type { AgentRun, AnalyzedDocument, AskAnswer, LanguageCode } from "../types";

/**
 * Provider boundary for all AI work.
 *
 * The app talks ONLY to this interface. Phase 1 wires FixtureProvider
 * (deterministic, offline). The live phase swaps in GemmaProvider without
 * touching any page or component.
 */

export interface UploadInput {
  fileName: string;
  mimeType: string;
  /** Data URL of the uploaded file/photo, when available. */
  dataUrl?: string;
  /** Decoded text for text uploads. */
  textContent?: string;
  /** Set when the user picked a built-in demo sample — enables cached fallback. */
  sampleId?: "dental-form" | "renewal-notice";
}

export interface AnalysisProgress {
  run: AgentRun;
}

export interface AnalysisResult {
  document: AnalyzedDocument;
  run: AgentRun;
}

export interface AnalysisProvider {
  /** Which engine is answering — shown in the UI so demos stay honest. */
  readonly mode: "fixtures" | "gemma";

  /**
   * Run the full multi-agent pipeline on an uploaded file or photo.
   * `onProgress` streams stage-by-stage agent status for the pipeline UI.
   */
  analyze(
    input: UploadInput,
    targetLanguage: LanguageCode,
    onProgress: (p: AnalysisProgress) => void,
  ): Promise<AnalysisResult>;

  /** Grounded question answering across the user's documents. */
  ask(question: string, documents: AnalyzedDocument[]): Promise<AskAnswer>;
}
