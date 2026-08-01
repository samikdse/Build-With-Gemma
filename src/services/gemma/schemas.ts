/**
 * JSON Schemas passed to Ollama's `format` for constrained decoding, plus
 * defensive TS validators that repair/reject whatever comes back.
 * Constrained decoding makes malformed shapes unlikely; the validators make
 * them impossible to propagate.
 */

/* ------------------------------------------------------------ extraction */

export const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    doc_type: {
      type: "string",
      enum: [
        "coverage_letter",
        "enrollment_form",
        "government_notice",
        "insurance_claim",
        "medical_referral",
        "other",
      ],
    },
    issuer: { type: "string" },
    recipient: { type: "string" },
    language: { type: "string" },
    transcript: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "date",
              "amount",
              "identifier",
              "coverage",
              "requirement",
              "contact",
              "warning",
              "action",
              "program",
            ],
          },
          label: { type: "string" },
          value: { type: "string" },
          date: { type: "string" },
          quote: { type: "string" },
        },
        required: ["category", "label", "value", "quote"],
      },
    },
    needs_confirmation: { type: "array", items: { type: "string" } },
  },
  required: ["title", "doc_type", "issuer", "recipient", "language", "transcript", "items"],
} as const;

export interface ExtractOut {
  title: string;
  doc_type: string;
  issuer: string;
  recipient: string;
  language: string;
  transcript: string;
  items: {
    category: string;
    label: string;
    value: string;
    date?: string;
    quote: string;
  }[];
  needs_confirmation: string[];
}

/** Strip model special tokens that occasionally leak into vision transcripts. */
function stripSpecialTokens(s: string): string {
  return s.replace(/<\/?[a-z_]+_of_[a-z_]+>|<\|[^|]*\|>/g, "").trim();
}

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

/** Deterministically parse human-format dates ("September 30, 2026") to ISO. */
export function parseHumanDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso && isISODate(iso[1])) return iso[1];
  const m = text.toLowerCase().match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/,
  );
  if (m) {
    const candidate = `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, "0")}`;
    if (isISODate(candidate)) return candidate;
  }
  return undefined;
}

export function validateExtract(raw: unknown): ExtractOut {
  const o = asObject(raw);
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    title: stripSpecialTokens(str(o.title, "Untitled document")),
    doc_type: str(o.doc_type, "other"),
    issuer: str(o.issuer, "Unknown issuer"),
    recipient: str(o.recipient, "Unknown recipient"),
    language: str(o.language, "en").slice(0, 2).toLowerCase(),
    transcript: stripSpecialTokens(str(o.transcript, "")),
    items: items
      .filter((it: unknown): it is Record<string, unknown> => typeof it === "object" && it !== null)
      .map((it) => {
        const value = str(it.value, "").slice(0, 400);
        const explicit = isISODate(str(it.date, "")) ? str(it.date, "") : undefined;
        return {
          category: str(it.category, "requirement"),
          label: str(it.label, "").slice(0, 120),
          value,
          // model-supplied ISO date, else deterministic parse of the value text
          date: explicit ?? parseHumanDate(value),
          quote: str(it.quote, "").slice(0, 400),
        };
      })
      // an item without label+value+quote is unusable — drop, don't guess
      .filter((it) => it.label && it.value && it.quote),
    needs_confirmation: strArray(o.needs_confirmation),
  };
}

/* ----------------------------------------------------------- translation */

export const TRANSLATE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    steps: { type: "array", items: { type: "string" } },
    kept_original: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "steps"],
} as const;

export interface TranslateOut {
  summary: string;
  steps: string[];
  kept_original: string[];
}

export function validateTranslate(raw: unknown): TranslateOut {
  const o = asObject(raw);
  const summary = str(o.summary, "");
  if (!summary) throw new Error("translation missing summary");
  return { summary, steps: strArray(o.steps), kept_original: strArray(o.kept_original) };
}

/* -------------------------------------------------------- simplification */

export const SIMPLIFY_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    what_this_means: { type: "string" },
    attention: { type: "array", items: { type: "string" } },
    unclear_terms: {
      type: "array",
      items: {
        type: "object",
        properties: { term: { type: "string" }, meaning: { type: "string" } },
        required: ["term", "meaning"],
      },
    },
  },
  required: ["summary", "what_this_means", "attention"],
} as const;

export interface SimplifyOut {
  summary: string;
  what_this_means: string;
  attention: string[];
  unclear_terms: { term: string; meaning: string }[];
}

export function validateSimplify(raw: unknown): SimplifyOut {
  const o = asObject(raw);
  const summary = str(o.summary, "");
  if (!summary) throw new Error("simplify missing summary");
  const terms = Array.isArray(o.unclear_terms) ? o.unclear_terms : [];
  return {
    summary,
    what_this_means: str(o.what_this_means, ""),
    attention: strArray(o.attention).slice(0, 4),
    unclear_terms: terms
      .filter((t: unknown): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => ({ term: str(t.term, ""), meaning: str(t.meaning, "") }))
      .filter((t) => t.term && t.meaning)
      .slice(0, 6),
  };
}

/* ------------------------------------------------------------- coverage */

export const COVERAGE_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          program_id: { type: "string" },
          headline: { type: "string" },
          why: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                fact_ids: { type: "array", items: { type: "string" } },
              },
              required: ["text", "fact_ids"],
            },
          },
          missing: { type: "array", items: { type: "string" } },
          conflicting: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["possible", "needs_more_information"] },
        },
        required: ["program_id", "headline", "why", "missing", "confidence"],
      },
    },
  },
  required: ["matches"],
} as const;

export interface CoverageOut {
  matches: {
    program_id: string;
    headline: string;
    why: { text: string; fact_ids: string[] }[];
    missing: string[];
    conflicting: string[];
    confidence: "possible" | "needs_more_information";
  }[];
}

const BANNED_ELIGIBILITY = /you are eligible|you qualify|guaranteed|you will receive|approved for/i;

export function validateCoverage(raw: unknown, allowedProgramIds: Set<string>): CoverageOut {
  const o = asObject(raw);
  const matches = Array.isArray(o.matches) ? o.matches : [];
  return {
    matches: matches
      .filter((m: unknown): m is Record<string, unknown> => typeof m === "object" && m !== null)
      .filter((m) => allowedProgramIds.has(str(m.program_id, "")))
      .map((m) => ({
        program_id: str(m.program_id, ""),
        // hard safety net: certainty language is stripped at the boundary
        headline: BANNED_ELIGIBILITY.test(str(m.headline, ""))
          ? "This appears worth checking"
          : str(m.headline, "This appears worth checking"),
        why: (Array.isArray(m.why) ? m.why : [])
          .filter((w: unknown): w is Record<string, unknown> => typeof w === "object" && w !== null)
          .map((w) => ({ text: str(w.text, ""), fact_ids: strArray(w.fact_ids) }))
          .filter((w) => w.text && !BANNED_ELIGIBILITY.test(w.text)),
        missing: strArray(m.missing),
        conflicting: strArray(m.conflicting),
        confidence: m.confidence === "possible" ? "possible" : "needs_more_information",
      })),
  };
}

/* --------------------------------------------------------------- action */

export const ACTION_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          deadline: { type: "string" },
          fact_ids: { type: "array", items: { type: "string" } },
        },
        required: ["text", "fact_ids"],
      },
    },
    reminders: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tool: { type: "string", enum: ["create_reminder"] },
          title: { type: "string" },
          due_at: { type: "string" },
          reason: { type: "string" },
          source_fact_id: { type: "string" },
        },
        required: ["tool", "title", "due_at", "reason"],
      },
    },
  },
  required: ["steps", "reminders"],
} as const;

export interface ActionOut {
  steps: { text: string; deadline?: string; fact_ids: string[] }[];
  reminders: { tool: "create_reminder"; title: string; due_at: string; reason: string; source_fact_id?: string }[];
}

export function validateAction(raw: unknown): ActionOut {
  const o = asObject(raw);
  const steps = Array.isArray(o.steps) ? o.steps : [];
  const reminders = Array.isArray(o.reminders) ? o.reminders : [];
  return {
    steps: steps
      .filter((s: unknown): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => ({
        // models sometimes inline the fact ids into prose — strip them
        text: str(s.text, "").replace(/\s*\(?fact-[a-z0-9-]+\)?,?/gi, "").replace(/\s{2,}/g, " ").trim(),
        deadline: isISODate(str(s.deadline, "")) ? str(s.deadline, "") : parseHumanDate(str(s.deadline, "")),
        fact_ids: strArray(s.fact_ids),
      }))
      .filter((s) => s.text)
      .slice(0, 6),
    reminders: reminders
      .filter((r: unknown): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .map((r) => ({
        tool: "create_reminder" as const,
        title: str(r.title, "").slice(0, 120),
        due_at: str(r.due_at, ""),
        reason: str(r.reason, ""),
        source_fact_id: str(r.source_fact_id, "") || undefined,
      }))
      .filter((r) => r.title && /^\d{4}-\d{2}-\d{2}/.test(r.due_at))
      .slice(0, 2),
  };
}

/* ---------------------------------------------------------- verification */

export const VERIFY_SCHEMA = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim_id: { type: "string" },
          verdict: { type: "string", enum: ["supported", "uncertain"] },
          note: { type: "string" },
        },
        required: ["claim_id", "verdict"],
      },
    },
  },
  required: ["verdicts"],
} as const;

export interface VerifyOut {
  verdicts: { claim_id: string; verdict: "supported" | "uncertain"; note?: string }[];
}

export function validateVerify(raw: unknown): VerifyOut {
  const o = asObject(raw);
  const verdicts = Array.isArray(o.verdicts) ? o.verdicts : [];
  return {
    verdicts: verdicts
      .filter((v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null)
      .map((v) => ({
        claim_id: str(v.claim_id, ""),
        verdict: v.verdict === "supported" ? ("supported" as const) : ("uncertain" as const),
        note: str(v.note, "") || undefined,
      }))
      .filter((v) => v.claim_id),
  };
}

/* -------------------------------------------------------------- ask (QA) */

export const ASK_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
  },
  required: ["answer"],
} as const;

/* ------------------------------------------------------------ utilities */

function asObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) throw new Error("model output is not an object");
  return raw as Record<string, unknown>;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

export function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00").getTime());
}
