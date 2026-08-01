import {
  AGENTS,
  type AgentRun,
  type AgentStage,
  type AnalyzedDocument,
  type AskAnswer,
  type CoverageInsight,
  type DocumentKind,
  type ExtractedFact,
  type LanguageCode,
  LANGUAGES,
} from "../types";
import type { AnalysisProgress, AnalysisProvider, AnalysisResult, UploadInput } from "./provider";
import { COVERAGE_PROGRAMS } from "../fixtures/programs";

/**
 * Production provider: talks to our own Vercel serverless routes, which hold
 * the hosted Gemma key server-side. The browser never sees a key and never
 * calls the model provider directly.
 *
 * Latency budget: ONE hosted request to analyze, one more only if a
 * translation is requested. Ask = one lexical retrieval + one hosted request.
 */

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays inside Vercel's request limit

export class HostedUploadError extends Error {}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}) as any);
  if (!res.ok || data.ok === false) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

/** Lexical retrieval over the user's own segments — no embedding call. */
export function retrieveLexical(
  question: string,
  documents: AnalyzedDocument[],
  k = 6,
): { documentId: string; segmentId: string; text: string; score: number }[] {
  const stop = new Set([
    "the","a","an","is","are","do","does","my","i","what","when","which","of","to","for","in","on",
    "и","el","la","de","que","mi","cuando","cual","los","las","un","una","es","son","je","le","les",
  ]);
  const terms = question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2 && !stop.has(t));

  const rows: { documentId: string; segmentId: string; text: string; score: number }[] = [];
  for (const doc of documents) {
    for (const seg of doc.segments) {
      const hay = seg.text.toLowerCase();
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score += 1;
      // facts pointing at this segment boost it
      for (const f of doc.facts) {
        if (!f.citations.includes(seg.id)) continue;
        const fh = `${f.label} ${f.value}`.toLowerCase();
        for (const t of terms) if (fh.includes(t)) score += 0.5;
      }
      if (score > 0) rows.push({ documentId: doc.id, segmentId: seg.id, text: seg.text, score });
    }
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, k);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HostedProvider implements AnalysisProvider {
  readonly mode = "gemma" as const;

  async analyze(
    input: UploadInput,
    targetLanguage: LanguageCode,
    onProgress: (p: AnalysisProgress) => void,
  ): Promise<AnalysisResult> {
    const run: AgentRun = {
      documentId: "pending",
      startedAt: new Date().toISOString(),
      engine: "gemma",
      stages: AGENTS.map((a) => ({ agent: a.id, status: "pending", logs: [] }) as AgentStage),
    };
    const emit = () => onProgress({ run: { ...run, stages: run.stages.map((s) => ({ ...s })) } });
    const stage = (id: string) => run.stages.find((s) => s.agent === id)!;
    const setStage = (id: string, status: AgentStage["status"], log?: string) => {
      const s = stage(id);
      s.status = status;
      if (log) s.logs.push(log);
      emit();
    };

    const isImage = input.mimeType.startsWith("image/");
    let payload: { text?: string; imageBase64?: string; imageMimeType?: string };

    setStage("document", "running", isImage ? "Reading the photo" : "Reading the document");

    if (isImage) {
      const b64 = input.dataUrl?.split(",")[1];
      if (!b64) throw new HostedUploadError("That image could not be read. Please try another photo.");
      if (b64.length * 0.75 > MAX_UPLOAD_BYTES) {
        throw new HostedUploadError("That image is larger than 4 MB. Please use a smaller photo.");
      }
      payload = { imageBase64: b64, imageMimeType: input.mimeType };
    } else if (input.mimeType === "application/pdf") {
      const text = await extractPdfText(input.dataUrl ?? "");
      setStage("document", "running", `Read ${text.pages} page(s)`);
      payload = { text: text.text };
    } else {
      payload = { text: input.textContent ?? "" };
    }

    // ---------- ONE hosted request covers document, plain language, actions ----------
    const t0 = performance.now();
    const { analysis } = await postJSON<{ analysis: HostedAnalysis }>("/api/analyze", payload);
    const ms = Math.round(performance.now() - t0);

    stage("document").ms = ms;
    setStage(
      "document",
      "done",
      `${analysis.stats.factCount} facts · ${analysis.stats.grounded} grounded to the original`,
    );
    setStage("plain_language", "done", "Rewritten in plain language");
    setStage("action", "done", `${analysis.stats.stepCount} steps${analysis.reminder ? " · 1 reminder proposed" : ""}`);

    // ---------- coverage: deterministic screening + KB benefit copy ----------
    setStage("coverage", "running", "Checking assistance programs");
    const insights = screenCoverage(analysis);
    setStage("coverage", "done", `${insights.length} possible match(es)`);

    // ---------- translation: second hosted request, only when needed ----------
    const translations: AnalyzedDocument["translations"] = [];
    if (targetLanguage !== "en") {
      const langLabel = LANGUAGES.find((l) => l.code === targetLanguage)?.label ?? targetLanguage;
      setStage("translation", "running", `Translating to ${langLabel}`);
      try {
        const { translation } = await postJSON<{ translation: HostedTranslation }>("/api/translate", {
          language: langLabel,
          summary: analysis.summary,
          points: analysis.whatMatters,
          steps: analysis.steps.map((s) => s.text),
        });
        translations.push({
          language: targetLanguage,
          plainSummary: translation.summary,
          steps: translation.steps,
        });
        setStage(
          "translation",
          "done",
          translation.preservedAll
            ? "Amounts, dates and identifiers preserved"
            : `⚠ check: ${translation.lostTokens.join(", ")}`,
        );
      } catch {
        setStage("translation", "error", "Translation unavailable — original shown");
      }
    } else {
      setStage("translation", "skipped", "English — no translation needed");
    }

    // ---------- verification: deterministic report of grounding ----------
    setStage("verification", "running", "Checking claims against the original");
    await sleep(120);
    const uncertain = analysis.facts.filter((f) => f.verification === "uncertain").length;
    setStage(
      "verification",
      "done",
      `${analysis.facts.length + analysis.steps.length} claims checked · ${uncertain} marked uncertain`,
    );

    const keyDateFact = analysis.facts
      .filter((f) => f.date && f.date >= new Date().toISOString().slice(0, 10))
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];

    const document: AnalyzedDocument = {
      id: `doc-hosted-${Date.now().toString(36)}`,
      title: analysis.title,
      kind: normalizeKind(analysis.docType),
      issuer: analysis.issuer,
      recipient: analysis.recipient || "You",
      uploadedAt: new Date().toISOString(),
      status: "ready",
      isImage,
      language: (analysis.language as LanguageCode) || "en",
      keyDate: keyDateFact ? { label: keyDateFact.label, date: keyDateFact.date! } : undefined,
      programs: analysis.facts.filter((f) => f.category === "program").map((f) => f.value),
      plainSummary: analysis.summary,
      facts: analysis.facts as ExtractedFact[],
      steps: analysis.steps,
      translations,
      insights,
      segments: analysis.segments,
      suggestedReminders: analysis.reminder
        ? [
            {
              title: analysis.reminder.title,
              dueAt: `${analysis.reminder.dueAt}T09:00`,
              reason: analysis.reminder.reason,
              proposedBy: "gemma",
            },
          ]
        : [],
      connections: [],
      engine: "gemma",
      plain: { whatThisMeans: "", attention: analysis.whatMatters, unclearTerms: [] },
      needsConfirmation: analysis.needsConfirmation,
    };

    run.documentId = document.id;
    run.finishedAt = new Date().toISOString();
    run.verification = {
      checked: analysis.facts.length + analysis.steps.length,
      kept: analysis.facts.length + analysis.steps.length - uncertain,
      flagged: uncertain,
    };
    emit();
    return { document, run };
  }

  async ask(question: string, documents: AnalyzedDocument[]): Promise<AskAnswer> {
    const hits = retrieveLexical(question, documents, 6);
    if (hits.length === 0) return notFound(question);

    const data = await postJSON<{
      status: "answered" | "not_found";
      paragraphs?: { text: string; passageIndexes: number[] }[];
    }>("/api/ask", { question, passages: hits.map((h) => ({ text: h.text })) });

    if (data.status !== "answered" || !data.paragraphs?.length) return notFound(question);

    return {
      question,
      status: "answered",
      fromCache: false,
      paragraphs: data.paragraphs.map((p) => ({
        text: p.text,
        citations: p.passageIndexes
          .map((i) => hits[i - 1])
          .filter(Boolean)
          .map((h) => ({ documentId: h.documentId, segmentId: h.segmentId })),
      })),
    };
  }
}

/* ------------------------------------------------------------------ types */

interface HostedAnalysis {
  title: string;
  docType: string;
  issuer: string;
  recipient: string;
  language: string;
  summary: string;
  whatMatters: string[];
  transcript: string;
  segments: { id: string; text: string }[];
  facts: ExtractedFact[];
  steps: { order: number; text: string; deadline?: string; citations: string[] }[];
  missing: string[];
  needsConfirmation: string[];
  reminder: { title: string; dueAt: string; reason: string } | null;
  stats: { factCount: number; grounded: number; stepCount: number };
}

interface HostedTranslation {
  summary: string;
  points: string[];
  steps: string[];
  preservedAll: boolean;
  lostTokens: string[];
}

/* ---------------------------------------------------------------- helpers */

function notFound(question: string): AskAnswer {
  return {
    question,
    status: "not_found",
    fromCache: false,
    paragraphs: [
      {
        text: "Your documents don't contain the answer to this. CareLens only answers from documents you have added — it does not guess.",
        citations: [],
      },
    ],
  };
}

const KINDS = [
  "coverage_letter",
  "enrollment_form",
  "government_notice",
  "insurance_claim",
  "medical_referral",
  "other",
];
const normalizeKind = (k: string): DocumentKind =>
  (KINDS.includes(k) ? k : "other") as DocumentKind;

/** Deterministic program screening; the model never invents a program. */
function screenCoverage(a: HostedAnalysis): CoverageInsight[] {
  const hay = a.facts.map((f) => `${f.label} ${f.value}`).join(" | ").toLowerCase() + " " + a.summary.toLowerCase();
  const out: CoverageInsight[] = [];
  const add = (programId: string, why: string, factMatch: RegExp) => {
    if (out.some((o) => o.programId === programId)) return;
    const prog = COVERAGE_PROGRAMS.find((p) => p.id === programId);
    if (!prog) return;
    const cites = a.facts.filter((f) => factMatch.test(`${f.label} ${f.value}`.toLowerCase())).flatMap((f) => f.citations);
    out.push({
      id: `ins-${programId}-${out.length}`,
      programId,
      headline: "This appears worth checking",
      whyItMayMatch: [{ text: why, citations: [...new Set(cites)].slice(0, 2) }],
      missingInformation: a.missing.slice(0, 3),
      potentialBenefit: prog.potentialBenefit,
      confidence: a.missing.length > 0 ? "needs_more_information" : "possible",
    });
  };

  if (/dental/.test(hay) && /(exclud|not includ|no dental|absence of dental|does not include)/.test(hay)) {
    add("prog-dental", "Your documents mention that dental care is not covered by your current plan, which is what this program is for.", /dental/);
  } else if (/dental/.test(hay)) {
    add("prog-dental", "Your documents relate to dental coverage support.", /dental/);
  }
  if (/(prescription|drug)/.test(hay) && /(80|copay|co-pay|%)/.test(hay)) {
    add("prog-copay", "Your plan appears to cover only part of prescription costs, which is the situation this program is for.", /prescription|drug/);
  }
  if (/(provincial assistance|health supplement|assistance office)/.test(hay)) {
    add("prog-transport", "Your documents mention provincial assistance, which this travel-support program is based on.", /assistance|supplement/);
  }
  return out;
}

/** Local PDF text extraction (unchanged, text-based PDFs only). */
async function extractPdfText(dataUrl: string): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const t = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (t) parts.push(t);
  }
  const text = parts.join("\n\n");
  if (!text.trim()) {
    throw new HostedUploadError(
      "This PDF has no readable text (it looks scanned). Take a photo of the page and upload that instead.",
    );
  }
  return { text, pages: doc.numPages };
}

export const hostedProvider = new HostedProvider();
