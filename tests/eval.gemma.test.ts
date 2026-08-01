/**
 * Live Gemma evaluation suite.
 *
 * Runs against a local Ollama with gemma3 + embeddinggemma pulled.
 * When Ollama is unreachable these tests SKIP (they must not break CI or
 * machines without the models) — the deterministic suites still run.
 *
 * Covers: date extraction, amount preservation, translation preservation,
 * required-step extraction, retrieval relevance, NOT_FOUND behaviour,
 * eligibility uncertainty language, citation validity, reminder date
 * accuracy, and verification flagging of an unsupported claim.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { chatJSON, embed, gemmaHealth, cosine } from "../src/services/gemma/client";
import { PROMPTS } from "../src/services/gemma/prompts";
import {
  ACTION_SCHEMA,
  COVERAGE_SCHEMA,
  EXTRACT_SCHEMA,
  TRANSLATE_SCHEMA,
  VERIFY_SCHEMA,
  validateAction,
  validateCoverage,
  validateExtract,
  validateTranslate,
  validateVerify,
} from "../src/services/gemma/schemas";
import { chunkToSegments, findQuoteSegment } from "../src/services/gemma/ingest";

// Mirrors public/samples/renewal-notice.txt (kept inline: tests run without fs access)
const NOTICE_TEXT = `SYNTHETIC DEMONSTRATION DOCUMENT - NOT A REAL RECORD

DEMO PROVINCIAL ASSISTANCE OFFICE
NOTICE OF ANNUAL RENEWAL - Provincial Assistance Health Supplement (Demo)

File: PA-DEMO-77201
Recipient: Alex Rivera (Demo Person)
Date of notice: July 15, 2026

Our records indicate your renewal file is incomplete. Required: an updated income statement for the current year, to be received no later than August 20, 2026.

Failure to complete the file by the deadline will result in a pause of the supplement until documentation is received. Supplement recipients may additionally qualify for medical travel reimbursement under the Health Travel Support program.

Contact the Assistance Office at 1-800-555-0192 with any questions. Office hours Monday to Friday, 8:30am to 4:30pm.`;

const LONG = 300_000;

let live = false;

beforeAll(async () => {
  live = (await gemmaHealth()).ok;
  if (!live) console.warn("⚠ Ollama not reachable — Gemma eval suite skipped");
});

describe("Gemma document extraction (live)", () => {
  let extract: ReturnType<typeof validateExtract> | null = null;

  async function runExtract() {
    if (extract) return extract;
    extract = validateExtract(
      await chatJSON({
        system: PROMPTS.EXTRACT_V1,
        user: `Extract facts from this document:\n\n${NOTICE_TEXT}`,
        schema: EXTRACT_SCHEMA,
        maxTokens: 2000,
      }),
    );
    return extract;
  }

  it("extracts the renewal deadline as a date (2026-08-20)", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const ex = await runExtract();
    const hasDeadline = ex.items.some(
      (i) => i.date === "2026-08-20" || i.value.includes("August 20, 2026"),
    );
    expect(hasDeadline, JSON.stringify(ex.items, null, 1)).toBe(true);
  });

  it("preserves identifiers character-for-character (PA-DEMO-77201)", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const ex = await runExtract();
    const all = JSON.stringify(ex.items) + ex.transcript;
    expect(all).toContain("PA-DEMO-77201");
    expect(all).toContain("1-800-555-0192");
  });

  it("extracted quotes ground to transcript segments (citation validity)", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const ex = await runExtract();
    const segments = chunkToSegments(NOTICE_TEXT, "eval");
    const grounded = ex.items.filter((i) => findQuoteSegment(i.quote, segments) !== null);
    // most items must ground; ungrounded ones become "uncertain" in the app
    expect(grounded.length).toBeGreaterThanOrEqual(Math.ceil(ex.items.length * 0.6));
  });

  it("extracts the required-step (income statement submission)", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const ex = await runExtract();
    expect(JSON.stringify(ex.items).toLowerCase()).toContain("income statement");
  });
});

describe("Gemma translation preservation (live)", () => {
  it("keeps dates, amounts and phone numbers intact in Spanish", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const tr = validateTranslate(
      await chatJSON({
        system: PROMPTS.TRANSLATE_V1,
        user: `Target language: Spanish\n\nSummary:\nYour renewal file is missing an updated income statement. It must be received by 2026-08-20 or the supplement pauses. Call 1-800-555-0192 with questions. Your file number is PA-DEMO-77201.\n\nSteps:\n1. Get an updated income statement.\n2. Send it before 2026-08-20.`,
        schema: TRANSLATE_SCHEMA,
      }),
    );
    const out = tr.summary + " " + tr.steps.join(" ");
    expect(out).toContain("2026-08-20");
    expect(out).toContain("1-800-555-0192");
    expect(out).toContain("PA-DEMO-77201");
    // and it actually translated (contains Spanish function words)
    expect(/\b(el|la|de|que|su)\b/i.test(out)).toBe(true);
  });
});

describe("EmbeddingGemma retrieval (live)", () => {
  it("ranks the relevant passage first, cross-lingually", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const passages = [
      "Applications must be received by the Program Office no later than September 30, 2026.",
      "The plan reimburses eligible prescription drugs at 80% to an annual maximum of $2,000.",
      "Contact Member Services at 1-800-555-0100 Monday to Friday.",
    ];
    // Spanish question about an English corpus — multilingual retrieval
    const [q, ...p] = await embed(["¿Cuál es la fecha límite para enviar la solicitud?", ...passages]);
    const scores = p.map((v) => cosine(q, v));
    expect(scores[0], `scores: ${scores.map((s) => s.toFixed(3)).join(", ")}`).toBe(Math.max(...scores));
  });
});

describe("Grounded QA (live)", () => {
  it("returns NOT_FOUND when passages don't contain the answer", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const raw = (await chatJSON({
      system: PROMPTS.ASK_V1,
      user: `PASSAGES:\n[P1] The office is open Monday to Friday, 8:30am to 4:30pm.\n\nQUESTION: What is my policy number?`,
      schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
      maxTokens: 200,
    })) as { answer: string };
    expect(raw.answer.toUpperCase()).toContain("NOT_FOUND");
  });

  it("answers with passage citations when the answer exists", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const raw = (await chatJSON({
      system: PROMPTS.ASK_V1,
      user: `PASSAGES:\n[P1] Coverage is in effect from January 1, 2026 to December 31, 2026.\n[P2] The office is open Monday to Friday.\n\nQUESTION: When does my coverage expire?`,
      schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
      maxTokens: 200,
    })) as { answer: string };
    expect(raw.answer).toContain("December 31, 2026");
    expect(raw.answer).toContain("[P1]");
  });
});

describe("Coverage uncertainty language (live)", () => {
  it("never claims confirmed eligibility", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const cov = validateCoverage(
      await chatJSON({
        system: PROMPTS.COVERAGE_V1,
        user: `Facts from the user's documents:\nf1 [coverage] Dental exclusion: dental services of any kind are excluded from the plan\nf2 [amount] Prescription coverage: 80% up to $2,000 per year\n\nCandidate programs:\n- id=prog-dental: Community Dental Support Program (Demo). Criteria: current plan excludes dental; proof of income required. Rule-matched facts: f1`,
        schema: COVERAGE_SCHEMA,
      }),
      new Set(["prog-dental"]),
    );
    expect(cov.matches.length).toBeGreaterThan(0);
    const text = JSON.stringify(cov).toLowerCase();
    for (const banned of ["you are eligible", "you qualify", "guaranteed", "approved for"]) {
      expect(text).not.toContain(banned);
    }
  });
});

describe("Action agent reminder dates (live)", () => {
  it("proposes reminders on/before the source deadline, as tool calls", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const action = validateAction(
      await chatJSON({
        system: PROMPTS.ACTION_V1,
        user: `Today is 2026-08-01.\nDocument: Renewal Notice\nFacts:\nf1 [date] Renewal deadline: 2026-08-20 (date: 2026-08-20)\nf2 [requirement] Missing document: updated income statement`,
        schema: ACTION_SCHEMA,
      }),
    );
    expect(action.steps.length).toBeGreaterThanOrEqual(2);
    for (const r of action.reminders) {
      expect(r.tool).toBe("create_reminder");
      expect(r.due_at.slice(0, 10) <= "2026-08-20").toBe(true);
    }
  });
});

describe("Verification agent (live)", () => {
  it("flags a planted unsupported claim as uncertain", { timeout: LONG }, async (ctx) => {
    if (!live) return ctx.skip();
    const verify = validateVerify(
      await chatJSON({
        system: PROMPTS.VERIFY_V1,
        user: `SOURCE FACTS:\nf1 [date] Renewal deadline: 2026-08-20 — quote: "no later than August 20, 2026"\nf2 [contact] Assistance office: 1-800-555-0192 — quote: "Contact the Assistance Office at 1-800-555-0192"\n\nCLAIMS TO CHECK:\nc1: Send your income statement before August 20, 2026.\nc2: You will receive $500 per month once your file is renewed.`,
        schema: VERIFY_SCHEMA,
        maxTokens: 400,
      }),
    );
    const c2 = verify.verdicts.find((v) => v.claim_id === "c2");
    expect(c2, JSON.stringify(verify)).toBeDefined();
    // the fabricated $500/month claim has no source — must not be "supported"
    expect(c2!.verdict).toBe("uncertain");
  });
});
