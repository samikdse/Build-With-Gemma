import { AGENTS, type AgentRun, type AgentStage, type AnalyzedDocument, type LanguageCode } from "../types";
import type { AnalysisProgress, AnalysisProvider, AnalysisResult, UploadInput } from "./provider";
import { DENTAL_FORM_DOC, NOTICE_DOC } from "../fixtures/documents";
import { ASK_FIXTURES, NOT_FOUND_ANSWER } from "../fixtures/ask";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Stage script: [agent, duration ms, log lines] */
type StageScript = [string, number, string[]][];

function scriptFor(doc: AnalyzedDocument, lang: LanguageCode): StageScript {
  const langLabel = lang.toUpperCase();
  return [
    [
      "document",
      1400,
      doc.isImage
        ? [
            "Reading photographed document (image input)",
            "Detected form layout, 5 text regions",
            `Extracted ${doc.facts.length} structured facts`,
          ]
        : [
            "Reading document text",
            `Detected ${doc.segments.length} source sections`,
            `Extracted ${doc.facts.length} structured facts`,
          ],
    ],
    [
      "translation",
      lang === "en" ? 300 : 1100,
      lang === "en"
        ? ["Target language is English — translation not required"]
        : [
            `Translating to ${langLabel}`,
            "Preserving names, dates, amounts and identifiers",
          ],
    ],
    [
      "plain_language",
      900,
      ["Rewriting formal wording in plain terms", "Reading level target: grade 6–8"],
    ],
    [
      "coverage",
      1000,
      [
        "Comparing extracted facts with 4 demo programs",
        `${doc.insights.length} possible match(es) found`,
        doc.connections.length > 0
          ? "Found a connection to a previously uploaded document"
          : "No cross-document connections found",
      ],
    ],
    [
      "action",
      700,
      [
        `Built ${doc.steps.length} numbered steps`,
        doc.suggestedReminders.length > 0
          ? `Suggested ${doc.suggestedReminders.length} reminder(s)`
          : "No reminders suggested",
      ],
    ],
    [
      "verification",
      900,
      [
        `Checking ${doc.facts.length + doc.steps.length} claims against source text`,
        "All claims cite a source segment",
        "Unsupported claims: 0 removed",
      ],
    ],
  ];
}

function freshRun(documentId: string): AgentRun {
  return {
    documentId,
    startedAt: new Date().toISOString(),
    stages: AGENTS.map((a) => ({ agent: a.id, status: "pending", logs: [] } as AgentStage)),
  };
}

export class FixtureProvider implements AnalysisProvider {
  readonly mode = "fixtures" as const;

  async analyze(
    input: UploadInput,
    targetLanguage: LanguageCode,
    onProgress: (p: AnalysisProgress) => void,
  ): Promise<AnalysisResult> {
    // Demo routing: an image becomes the photographed dental form;
    // any other file becomes the government renewal notice.
    const isImage = input.mimeType.startsWith("image/");
    const base = isImage ? DENTAL_FORM_DOC : NOTICE_DOC;

    const document: AnalyzedDocument = {
      ...base,
      uploadedAt: new Date().toISOString(),
    };

    const run = freshRun(document.id);
    const script = scriptFor(document, targetLanguage);

    for (const [agentId, ms, logs] of script) {
      const stage = run.stages.find((s) => s.agent === agentId)!;
      stage.status = "running";
      onProgress({ run: { ...run, stages: run.stages.map((s) => ({ ...s })) } });

      // reveal log lines progressively
      for (const line of logs) {
        await sleep(ms / logs.length);
        stage.logs.push(line);
        onProgress({ run: { ...run, stages: run.stages.map((s) => ({ ...s })) } });
      }

      stage.status = agentId === "translation" && targetLanguage === "en" ? "skipped" : "done";
      stage.ms = ms;
      onProgress({ run: { ...run, stages: run.stages.map((s) => ({ ...s })) } });
    }

    run.finishedAt = new Date().toISOString();
    run.verification = {
      checked: document.facts.length + document.steps.length,
      kept: document.facts.length + document.steps.length,
      flagged: 0,
    };
    onProgress({ run: { ...run, stages: run.stages.map((s) => ({ ...s })) } });

    return { document, run };
  }

  async ask(
    question: string,
    _documents?: import("../types").AnalyzedDocument[],
  ): Promise<import("../types").AskAnswer> {
    await sleep(650); // deliberate, believable latency
    const q = question.toLowerCase();
    const hit = ASK_FIXTURES.find((f) => f.matchers.every((m) => q.includes(m)));
    if (hit) return { ...hit.answer, question };
    // single-keyword fallback pass
    const loose = ASK_FIXTURES.find((f) => f.matchers.some((m) => q.includes(m)));
    if (loose) return { ...loose.answer, question };
    return NOT_FOUND_ANSWER(question);
  }
}

export const fixtureProvider = new FixtureProvider();
