import type { AnalysisProvider } from "./provider";
import { fixtureProvider } from "./fixtureProvider";

/**
 * The one place the app chooses its AI engine.
 * Next phase: `export const provider: AnalysisProvider = new GemmaProvider()`.
 */
export const provider: AnalysisProvider = fixtureProvider;
