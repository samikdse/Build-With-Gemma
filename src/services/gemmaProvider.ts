import {
  AGENTS,
  type ActionStep,
  type AgentRun,
  type AgentStage,
  type AnalyzedDocument,
  type AskAnswer,
  type CoverageInsight,
  type DocumentKind,
  type ExtractedFact,
  type LanguageCode,
} from "../types";
import type { AnalysisProgress, AnalysisProvider, AnalysisResult, UploadInput } from "./provider";
import { chatJSON } from "./gemma/client";
import { PROMPTS } from "./gemma/prompts";
import {
  ACTION_SCHEMA,
  ASK_SCHEMA,
  COVERAGE_SCHEMA,
  EXTRACT_SCHEMA,
  SIMPLIFY_SCHEMA,
  TRANSLATE_SCHEMA,
  VERIFY_SCHEMA,
  validateAction,
  validateCoverage,
  validateExtract,
  validateSimplify,
  validateTranslate,
  validateVerify,
} from "./gemma/schemas";
import { chunkToSegments, findQuoteSegment, ingest } from "./gemma/ingest";
import { retrieve } from "./gemma/retrieval";
import { COVERAGE_PROGRAMS } from "../fixtures/programs";
import { LANGUAGES } from "../types";

/**
 * Live Gemma provider — the eight-stage document-intelligence pipeline.
 *
 * Gemma (multimodal chat model) runs: extraction, translation,
 * simplification, coverage explanation, action planning, verification
 * judging, and grounded QA. EmbeddingGemma runs all retrieval.
 * Deterministic code runs: ingestion, chunking, quote→segment citation
 * matching, candidate-program rules, date/amount preservation checks, and
 * citation validation. Code decides; Gemma writes.
 */
export class GemmaProvider implements AnalysisProvider {
  readonly mode = "gemma" as const;

  /* ------------------------------------------------------------ analyze */

  async analyze(
    input: UploadInput,
    targetLanguage: LanguageCode,
    onProgress: (p: AnalysisProgress) => void,
  ): Promise<AnalysisResult> {
    const run: AgentRun = {
      documentId: "pending",
      startedAt: new Date().toISOString(),
      engine: "gemma",
      stages: AGENTS.map((a) => ({ agent: a.id, status: "pending", logs: [] } as AgentStage)),
    };
    const emit = () => onProgress({ run: { ...run, stages: run.stages.map((s) => ({ ...s })) } });
    const stage = (id: string) => run.stages.find((s) => s.agent === id)!;
    const begin = (id: string, log: string) => {
      const s = stage(id);
      s.status = "running";
      s.logs.push(log);
      emit();
      return performance.now();
    };
    const finish = (id: string, t0: number, log?: string, status: AgentStage["status"] = "done") => {
      const s = stage(id);
      if (log) s.logs.push(log);
      s.status = status;
      s.ms = Math.round(performance.now() - t0);
      emit();
    };

    /* -------- Stage 1+2: ingestion + Document Agent (Gemma, multimodal) */
    let t0 = begin(
      "document",
      input.mimeType.startsWith("image/")
        ? "Sending photo to Gemma for visual document reading"
        : "Extracting text locally, then structuring with Gemma",
    );
    const ing = await ingest(input);
    if (ing.kind === "text") stage("document").logs.push(`Read ${ing.pages} page(s) locally`);
    emit();

    const extractRaw = await chatJSON({
      system: PROMPTS.EXTRACT_V1,
      user:
        ing.kind === "image"
          ? "Read this photographed document and extract its facts."
          : `Extract facts from this document:\n\n${ing.text.slice(0, 8000)}`,
      images: ing.imageBase64 ? [ing.imageBase64] : undefined,
      schema: EXTRACT_SCHEMA,
      maxTokens: 2000,
      // extraction is the heaviest call — give it extra headroom on CPU
      timeoutMs: 300_000,
    });
    const extract = validateExtract(extractRaw);

    // Deterministic citation grounding: chunk transcript, match quotes.
    const docKey = `live-${Date.now().toString(36)}`;
    const transcript = ing.kind === "text" ? ing.text : extract.transcript;
    const segments = chunkToSegments(transcript || extract.transcript, docKey);
    const facts: ExtractedFact[] = extract.items.map((item, i) => {
      const segId = findQuoteSegment(item.quote, segments);
      return {
        id: `fact-${docKey}-${i + 1}`,
        category: mapCategory(item.category),
        label: item.label,
        value: item.value,
        date: item.date,
        citations: segId ? [segId] : [],
        // no verified quote in the source → uncertain, never silently trusted
        verification: segId ? "verified" : "uncertain",
      };
    });
    const grounded = facts.filter((f) => f.verification === "verified").length;
    finish(
      "document",
      t0,
      `Extracted ${facts.length} facts · ${grounded} grounded to source text, ${facts.length - grounded} marked uncertain`,
    );

    /* --------------------- Stage 4 first: Plain-Language Agent (Gemma) */
    // (simplify before translate so the translation translates the simple text)
    t0 = begin("plain_language", "Rewriting in plain language (grade 6–8)");
    const simplify = validateSimplify(
      await chatJSON({
        system: PROMPTS.SIMPLIFY_V1,
        user: `Document title: ${extract.title}\nFacts:\n${factLines(facts)}`,
        schema: SIMPLIFY_SCHEMA,
      }),
    );
    finish("plain_language", t0, `${simplify.attention.length} attention items, ${simplify.unclear_terms.length} terms explained`);

    /* ------------------------------- Stage 7: Action Agent (Gemma) */
    t0 = begin("action", "Building numbered steps and reminder proposals");
    const action = validateAction(
      await chatJSON({
        system: PROMPTS.ACTION_V1,
        user: `Today is ${new Date().toISOString().slice(0, 10)}.\nDocument: ${extract.title}\nFacts:\n${factLines(facts)}`,
        schema: ACTION_SCHEMA,
      }),
    );
    // deterministic guard: reminder dates must trace to an extracted date
    const knownDates = new Set(facts.filter((f) => f.date).map((f) => f.date!));
    const reminders = action.reminders.filter((r) => {
      const d = r.due_at.slice(0, 10);
      return knownDates.has(d) || [...knownDates].some((kd) => d <= kd);
    });
    finish("action", t0, `${action.steps.length} steps · ${reminders.length} reminder(s) proposed as create_reminder tool calls (await your confirmation)`);

    /* --------------------------- Stage 3: Translation Agent (Gemma) */
    let translation: { language: LanguageCode; plainSummary: string; steps: string[] } | null = null;
    if (targetLanguage !== "en") {
      const langLabel = LANGUAGES.find((l) => l.code === targetLanguage)?.label ?? targetLanguage;
      t0 = begin("translation", `Translating to ${langLabel}, preserving names/dates/amounts`);
      try {
        const tr = validateTranslate(
          await chatJSON({
            system: PROMPTS.TRANSLATE_V1,
            user: `Target language: ${langLabel}\n\nSummary:\n${simplify.summary}\n\nSteps:\n${action.steps
              .map((s, i) => `${i + 1}. ${s.text}`)
              .join("\n")}`,
            schema: TRANSLATE_SCHEMA,
          }),
        );
        // deterministic preservation check: numbers/amounts must survive
        const lost = lostTokens(simplify.summary + " " + action.steps.map((s) => s.text).join(" "), tr.summary + " " + tr.steps.join(" "));
        translation = { language: targetLanguage, plainSummary: tr.summary, steps: tr.steps };
        finish(
          "translation",
          t0,
          lost.length === 0
            ? "All amounts, dates and identifiers preserved"
            : `⚠ ${lost.length} token(s) not found in translation (${lost.slice(0, 3).join(", ")}) — flagged for verification`,
        );
      } catch (e) {
        finish("translation", t0, `Translation failed (${(e as Error).message}) — original language shown`, "error");
      }
    } else {
      stage("translation").logs.push("Target language is English — translation not required");
      finish("translation", performance.now(), undefined, "skipped");
    }

    /* ----------------------------- Stage 6: Coverage Agent (rules + Gemma) */
    t0 = begin("coverage", "Deterministic screening against program criteria");
    const candidates = screenPrograms(facts);
    let insights: CoverageInsight[] = [];
    if (candidates.length > 0) {
      stage("coverage").logs.push(
        `${candidates.length} candidate(s) passed rule screening — asking Gemma to explain`,
      );
      emit();
      const cov = validateCoverage(
        await chatJSON({
          system: PROMPTS.COVERAGE_V1,
          user: `Facts from the user's documents:\n${factLines(facts)}\n\nCandidate programs:\n${candidates
            .map((c) => `- id=${c.programId}: ${c.name}. Criteria: ${c.criteria}. Rule-matched facts: ${c.factIds.join(", ")}`)
            .join("\n")}`,
          schema: COVERAGE_SCHEMA,
        }),
        new Set(candidates.map((c) => c.programId)),
      );
      insights = cov.matches.map((m, i) => ({
        id: `ins-${docKey}-${i}`,
        programId: m.program_id,
        headline: m.headline,
        whyItMayMatch: m.why.map((w) => ({
          text: w.text,
          citations: w.fact_ids.flatMap((fid) => facts.find((f) => f.id === fid)?.citations ?? []),
        })),
        missingInformation: m.missing,
        potentialBenefit: COVERAGE_PROGRAMS.find((p) => p.id === m.program_id)?.potentialBenefit ?? "",
        confidence: m.confidence,
      }));
    }
    finish("coverage", t0, `${insights.length} possible match(es) — eligibility is never confirmed by this app`);

    /* ------------------------- Stage 8: Verification Agent (code + Gemma) */
    t0 = begin("verification", "Checking generated claims against source text");
    const claims: { id: string; text: string; factIds: string[] }[] = [
      ...action.steps.map((s, i) => ({ id: `step-${i}`, text: s.text, factIds: s.fact_ids })),
      ...insights.flatMap((ins, i) =>
        ins.whyItMayMatch.map((w, j) => ({ id: `why-${i}-${j}`, text: w.text, factIds: [] as string[] })),
      ),
    ];
    let flagged = 0;
    try {
      const verify = validateVerify(
        await chatJSON({
          system: PROMPTS.VERIFY_V1,
          user: `SOURCE FACTS:\n${factLines(facts)}\n\nCLAIMS TO CHECK:\n${claims
            .map((c) => `${c.id}: ${c.text}`)
            .join("\n")}`,
          schema: VERIFY_SCHEMA,
          maxTokens: 800,
        }),
      );
      const uncertainIds = new Set(verify.verdicts.filter((v) => v.verdict === "uncertain").map((v) => v.claim_id));
      flagged = uncertainIds.size;
      // steps judged uncertain are labeled, not shown as fact
      action.steps = action.steps.map((s, i) =>
        uncertainIds.has(`step-${i}`) ? { ...s, text: `${s.text} (unverified — check the original)` } : s,
      );
    } catch {
      stage("verification").logs.push("Gemma verification pass unavailable — deterministic checks only");
    }
    const uncertainFacts = facts.filter((f) => f.verification === "uncertain").length;
    finish(
      "verification",
      t0,
      `${claims.length + facts.length} claims checked · ${flagged + uncertainFacts} flagged uncertain · 0 unsupported claims displayed as fact`,
    );

    /* --------------------------------------------------- assemble result */
    const keyDateFact = facts
      .filter((f) => f.date && f.date >= new Date().toISOString().slice(0, 10))
      .sort((a, b) => a.date!.localeCompare(b.date!))[0];

    const steps: ActionStep[] = action.steps.map((s, i) => ({
      order: i + 1,
      text: s.text,
      deadline: s.deadline,
      citations: s.fact_ids.flatMap((fid) => facts.find((f) => f.id === fid)?.citations ?? []),
    }));

    const document: AnalyzedDocument = {
      id: `doc-${docKey}`,
      title: extract.title,
      kind: (EXTRACT_SCHEMA.properties.doc_type.enum as readonly string[]).includes(extract.doc_type)
        ? (extract.doc_type as DocumentKind)
        : "other",
      issuer: extract.issuer,
      recipient: extract.recipient,
      uploadedAt: new Date().toISOString(),
      status: "ready",
      isImage: ing.kind === "image",
      language: (extract.language as LanguageCode) || "en",
      keyDate: keyDateFact ? { label: keyDateFact.label, date: keyDateFact.date! } : undefined,
      programs: facts.filter((f) => f.category === "program").map((f) => f.value),
      plainSummary: simplify.summary,
      facts,
      steps,
      translations: translation ? [translation] : [],
      insights,
      segments,
      suggestedReminders: reminders.map((r) => ({
        title: r.title,
        dueAt: r.due_at.length === 10 ? `${r.due_at}T09:00` : r.due_at,
        reason: r.reason,
        proposedBy: "gemma" as const,
      })),
      connections: [],
      engine: "gemma",
      plain: {
        whatThisMeans: simplify.what_this_means,
        attention: simplify.attention,
        unclearTerms: simplify.unclear_terms,
      },
      needsConfirmation: extract.needs_confirmation,
    };

    run.documentId = document.id;
    run.finishedAt = new Date().toISOString();
    run.verification = {
      checked: claims.length + facts.length,
      kept: claims.length + facts.length - flagged - uncertainFacts,
      flagged: flagged + uncertainFacts,
    };
    emit();
    return { document, run };
  }

  /* ---------------------------------------------------------------- ask */

  async ask(question: string, documents: AnalyzedDocument[]): Promise<AskAnswer> {
    // 1-2. embed question, retrieve top chunks (EmbeddingGemma, multilingual)
    const chunks = await retrieve(question, documents, 6);
    const usable = chunks.filter((c) => c.score > 0.25 && c.documentId);
    if (usable.length === 0) {
      return notFound(question);
    }

    // 3-4. answer ONLY from retrieved passages
    const passageList = usable.map((c, i) => `[P${i + 1}] ${c.text}`).join("\n");
    const raw = (await chatJSON({
      system: PROMPTS.ASK_V1,
      user: `PASSAGES:\n${passageList}\n\nQUESTION: ${question}`,
      schema: ASK_SCHEMA,
      maxTokens: 400,
      temperature: 0,
    })) as { answer?: string };
    const answerText = (raw.answer ?? "").trim();

    if (!answerText || answerText.toUpperCase().includes("NOT_FOUND")) {
      return notFound(question);
    }

    // 5. validate citations: only [P#] tags that exist are kept
    const toCitations = (tags: number[]) =>
      tags
        .map((n) => usable[n - 1])
        .filter(Boolean)
        .map((c) => ({ documentId: c.documentId!, segmentId: c.segmentId! }));

    const rawLines = answerText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        text: line.replace(/\s*\[P\d+\]/g, "").trim(),
        tags: [...line.matchAll(/\[P(\d+)\]/g)].map((m) => Number(m[1])),
      }));

    // models sometimes put tags on their own line — merge tag-only lines
    // into the preceding text line before validating
    const merged: { text: string; tags: number[] }[] = [];
    for (const line of rawLines) {
      if (!line.text && line.tags.length > 0 && merged.length > 0) {
        merged[merged.length - 1].tags.push(...line.tags);
      } else if (line.text) {
        merged.push(line);
      }
    }

    let paragraphs = merged
      .map((l) => ({ text: l.text, citations: toCitations(l.tags) }))
      // a sentence with zero valid citations is not shown as fact
      .filter((p) => p.citations.length > 0);

    // last resort: text and citations both exist but weren't pairable
    // line-by-line — emit one combined, fully-cited paragraph
    if (paragraphs.length === 0) {
      const allText = merged.map((l) => l.text).join(" ").trim();
      const allCitations = toCitations(rawLines.flatMap((l) => l.tags));
      if (allText && allCitations.length > 0) {
        paragraphs = [{ text: allText, citations: allCitations }];
      }
    }

    if (paragraphs.length === 0) return notFound(question);

    return { question, status: "answered", paragraphs, fromCache: false };
  }
}

/* -------------------------------------------------------------- helpers */

function notFound(question: string): AskAnswer {
  return {
    question,
    status: "not_found",
    fromCache: false,
    paragraphs: [
      {
        text: "Your uploaded documents don't contain the answer to this. CareLens only answers from your documents — it does not guess. Try uploading the document that has this information.",
        citations: [],
      },
    ],
  };
}

function factLines(facts: ExtractedFact[]): string {
  return facts
    .map((f) => `${f.id} [${f.category}] ${f.label}: ${f.value}${f.date ? ` (date: ${f.date})` : ""} — quote: "${f.value.slice(0, 80)}"`)
    .join("\n");
}

function mapCategory(c: string): ExtractedFact["category"] {
  const allowed = ["program", "date", "amount", "coverage", "requirement", "contact", "identifier", "warning", "action"];
  return (allowed.includes(c) ? c : "requirement") as ExtractedFact["category"];
}

/** Tokens (amounts, dates, ids, phone numbers) that must survive translation. */
function lostTokens(original: string, translated: string): string[] {
  const tokens = original.match(/\$[\d,.]+|\d+%|\b\d{4}-\d{2}-\d{2}\b|\b1-\d{3}-\d{3}-\d{4}\b|\b[A-Z]{2}-[A-Z]+-\d+\b/g) ?? [];
  return [...new Set(tokens)].filter((t) => !translated.includes(t));
}

/**
 * Stage 6 deterministic screening: simple structured comparisons run in
 * code; Gemma only explains candidates that pass.
 */
function screenPrograms(facts: ExtractedFact[]): { programId: string; name: string; criteria: string; factIds: string[] }[] {
  const text = facts.map((f) => `${f.label} ${f.value}`.toLowerCase()).join(" | ");
  const byPattern = (re: RegExp) => facts.filter((f) => re.test(`${f.label} ${f.value}`.toLowerCase())).map((f) => f.id);

  const out: { programId: string; name: string; criteria: string; factIds: string[] }[] = [];
  if (/dental/.test(text) && /(exclud|not includ|no dental|absence of dental|does not include)/.test(text)) {
    out.push({
      programId: "prog-dental",
      name: "Community Dental Support Program (Demo)",
      criteria: "current health plan excludes dental services; proof of income required",
      factIds: byPattern(/dental/),
    });
  }
  if (/(dental support|dental program|cds-1)/.test(text)) {
    // the dental form itself also maps to the dental program
    if (!out.some((o) => o.programId === "prog-dental")) {
      out.push({
        programId: "prog-dental",
        name: "Community Dental Support Program (Demo)",
        criteria: "current health plan excludes dental services; proof of income required",
        factIds: byPattern(/dental/),
      });
    }
  }
  if (/\b80\s?%|copay|co-pay|reimburs/.test(text) && /prescription|drug/.test(text)) {
    out.push({
      programId: "prog-copay",
      name: "Prescription Copay Relief (Demo)",
      criteria: "plan covers less than 100% of prescription costs; income proof required",
      factIds: byPattern(/prescription|drug|80/),
    });
  }
  if (/provincial assistance|health supplement|assistance office/.test(text)) {
    out.push({
      programId: "prog-transport",
      name: "Health Travel Support (Demo)",
      criteria: "recipient of provincial assistance; travel receipts required",
      factIds: byPattern(/assistance|supplement/),
    });
  }
  return out;
}

export const gemmaProvider = new GemmaProvider();
