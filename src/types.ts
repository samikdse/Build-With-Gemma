/** Canonical domain types for CareLens. */

export type LanguageCode =
  | "en"
  | "es"
  | "fr"
  | "tl"
  | "zh"
  | "ar"
  | "hi"
  | "pt";

export const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "fr", label: "French", native: "Français" },
  { code: "tl", label: "Tagalog", native: "Tagalog" },
  { code: "zh", label: "Mandarin", native: "中文" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "pt", label: "Portuguese", native: "Português" },
];

export type DocumentKind =
  | "coverage_letter"
  | "enrollment_form"
  | "government_notice"
  | "insurance_claim"
  | "medical_referral"
  | "other";

export type DocStatus = "processing" | "ready" | "error";

/** One citable region of the source document. */
export interface SourceSegment {
  id: string; // e.g. "seg-benefits-04"
  text: string;
}

export type FactCategory =
  | "program"
  | "date"
  | "amount"
  | "coverage"
  | "requirement"
  | "contact"
  | "identifier"
  | "warning"
  | "action";

export interface ExtractedFact {
  id: string;
  category: FactCategory;
  label: string;
  value: string;
  /** ISO date when the fact is date-like; drives deadline surfacing. */
  date?: string;
  citations: string[]; // SourceSegment ids
  verification: "verified" | "uncertain";
}

export interface ActionStep {
  order: number;
  text: string;
  deadline?: string; // ISO date
  citations: string[];
}

export interface TranslationBundle {
  language: LanguageCode;
  plainSummary: string;
  steps: string[];
}

export interface CoverageInsight {
  id: string;
  programId: string; // -> CoverageProgram
  headline: string;
  whyItMayMatch: { text: string; citations: string[] }[];
  missingInformation: string[];
  potentialBenefit: string;
  /** Never "eligible" — always hedged. */
  confidence: "possible" | "needs_more_information";
}

export interface AnalyzedDocument {
  id: string;
  title: string;
  kind: DocumentKind;
  issuer: string;
  recipient: string;
  uploadedAt: string; // ISO
  status: DocStatus;
  isImage: boolean;
  language: LanguageCode; // language of the source document
  keyDate?: { label: string; date: string };
  programs: string[]; // extracted program names
  plainSummary: string; // English plain-language explanation
  facts: ExtractedFact[];
  steps: ActionStep[];
  translations: TranslationBundle[];
  insights: CoverageInsight[];
  segments: SourceSegment[];
  suggestedReminders: SuggestedReminder[];
  /** Cross-document connections discovered during analysis. */
  connections: { text: string; relatedDocumentId: string; citations: string[] }[];
  /** Which engine produced this analysis. Absent = fixtures (legacy). */
  engine?: "gemma" | "fixtures";
  /** Extra plain-language output from the live Plain-Language Agent. */
  plain?: {
    whatThisMeans: string;
    attention: string[];
    unclearTerms: { term: string; meaning: string }[];
  };
  /** Extraction fields Gemma flagged as needing human confirmation. */
  needsConfirmation?: string[];
}

export interface CoverageProgram {
  id: string;
  name: string; // always carries "(Demo)"
  administrator: string;
  summary: string;
  potentialBenefit: string;
  applicationSteps: string[];
  officialContact: string;
}

export type ReminderStatus = "upcoming" | "done";

export interface Reminder {
  id: string;
  title: string;
  dueAt: string; // ISO datetime
  documentId?: string;
  reason: string;
  status: ReminderStatus;
  createdAt: string;
}

/**
 * A reminder PROPOSED by the Action Agent as a structured tool call
 * (create_reminder). Never executed automatically — the user confirms
 * in the UI before the app saves it.
 */
export interface SuggestedReminder {
  title: string;
  dueAt: string;
  reason: string;
  proposedBy?: "gemma" | "fixture";
}

/* ------------------------------ agent pipeline ------------------------------ */

export type AgentId =
  | "document"
  | "translation"
  | "plain_language"
  | "coverage"
  | "action"
  | "verification";

export const AGENTS: { id: AgentId; name: string; description: string }[] = [
  { id: "document", name: "Document Agent", description: "Reads the file or photo and extracts structured facts" },
  { id: "translation", name: "Translation Agent", description: "Translates while preserving names, dates and amounts" },
  { id: "plain_language", name: "Plain-Language Agent", description: "Rewrites difficult wording in simple terms" },
  { id: "coverage", name: "Coverage Agent", description: "Compares your documents with known assistance programs" },
  { id: "action", name: "Action Agent", description: "Builds your numbered next steps and reminder suggestions" },
  { id: "verification", name: "Verification Agent", description: "Checks every claim against the source text" },
];

export type StageStatus = "pending" | "running" | "done" | "skipped" | "error" | "fallback";

export interface AgentStage {
  agent: AgentId;
  status: StageStatus;
  logs: string[];
  ms?: number;
}

export interface AgentRun {
  documentId: string;
  stages: AgentStage[];
  startedAt: string;
  finishedAt?: string;
  /** Which engine actually produced the result. */
  engine?: "gemma" | "fixtures";
  /** Set when live Gemma failed and the cached demo result was served. */
  fallbackReason?: string;
  /** claims checked / claims kept by the Verification Agent */
  verification?: { checked: number; kept: number; flagged: number };
}

/* --------------------------------- Ask -------------------------------------- */

export interface AskCitation {
  documentId: string;
  segmentId: string;
}

export interface AskAnswer {
  question: string;
  status: "answered" | "not_found";
  paragraphs: { text: string; citations: AskCitation[] }[];
  fromCache: boolean;
}
