import {
  callGemma,
  errorBody,
  extractJSON,
  HostedError,
  readConfig,
} from "./_lib/hosted";
import {
  BANNED_ELIGIBILITY,
  chunkToSegments,
  findQuoteSegment,
  isISODate,
  parseHumanDate,
  type Segment,
} from "./_lib/text";

export const config = { maxDuration: 60 };

/**
 * Stage 1+2+4+6+7 collapsed into ONE hosted Gemma request.
 * The multi-agent design is preserved as labelled prompt sections; only the
 * production execution is collapsed, for latency.
 */
const ANALYZE_PROMPT = (text: string | null) => `You are a document-intelligence system for healthcare, insurance, benefits and government paperwork. You read a document and return one JSON object. You never invent anything.

Work through these roles in order, then return a single combined result:
[DOCUMENT] Read the document and transcribe it faithfully.
[EXTRACT] Pull out every date, amount, identifier, requirement, warning, contact and program.
[PLAIN] Rewrite what it says in plain language a grade 6-8 reader understands.
[ACTION] Turn it into numbered next steps.
[COVERAGE] Note what the reader still needs to provide.

RULES
- Use ONLY what the document states. Never guess a value; if unclear, list its label in needs_confirmation.
- Every item in "items" MUST include "quote": a short snippet copied VERBATIM from the transcript. No quote, no item.
- Copy amounts, percentages, policy numbers, phone numbers, emails and dates character-for-character.
- Dates: give ISO YYYY-MM-DD in "date" when the document states a full date.
- Never write "you are eligible", "you qualify", "guaranteed" or "approved". Use "you may be eligible" / "this appears worth checking".
- No medical, legal or financial advice. Administrative guidance only.

Return ONLY this JSON:
{
 "title": string,
 "doc_type": "coverage_letter"|"enrollment_form"|"government_notice"|"insurance_claim"|"medical_referral"|"other",
 "issuer": string,
 "recipient": string,
 "language": string,
 "transcript": string,
 "summary": string,
 "what_matters": [string],
 "items": [{"category":"date"|"amount"|"identifier"|"coverage"|"requirement"|"contact"|"warning"|"action"|"program","label":string,"value":string,"date":string,"quote":string}],
 "steps": [{"text":string,"deadline":string,"quote":string}],
 "missing": [string],
 "reminder": {"title":string,"due_at":"YYYY-MM-DD","reason":string},
 "needs_confirmation": [string]
}

${text ? `DOCUMENT TEXT:\n${text.slice(0, 12000)}` : "The document is the attached image. Read it."}`;

interface Body {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  const cfg = readConfig();
  if (!cfg) {
    res.status(503).json({ ok: false, error: "Hosted Gemma is not configured", reason: "no_key" });
    return;
  }

  const body: Body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  if (!body.text && !body.imageBase64) {
    res.status(400).json({ ok: false, error: "Nothing to analyze" });
    return;
  }

  try {
    const raw = await callGemma(cfg, {
      prompt: ANALYZE_PROMPT(body.text ?? null),
      imageBase64: body.imageBase64,
      imageMimeType: body.imageMimeType,
      maxTokens: 3000,
      timeoutMs: 45_000,
    });
    const out = extractJSON(raw);

    // ---- deterministic grounding: quotes must exist in the transcript ----
    const transcript: string = String(out.transcript ?? body.text ?? "").trim();
    const docKey = `h${Date.now().toString(36)}`;
    const segments: Segment[] = chunkToSegments(transcript, docKey);

    const rawItems: any[] = Array.isArray(out.items) ? out.items : [];
    const facts = rawItems
      .filter((i) => i && typeof i === "object")
      .map((i, idx) => {
        const value = String(i.value ?? "").slice(0, 400);
        const quote = String(i.quote ?? "").slice(0, 400);
        const segId = findQuoteSegment(quote, segments);
        const explicit = isISODate(String(i.date ?? "")) ? String(i.date) : undefined;
        return {
          id: `fact-${docKey}-${idx + 1}`,
          category: String(i.category ?? "requirement"),
          label: String(i.label ?? "").slice(0, 120),
          value,
          date: explicit ?? parseHumanDate(value),
          citations: segId ? [segId] : [],
          verification: segId ? "verified" : "uncertain",
        };
      })
      .filter((f) => f.label && f.value);

    const rawSteps: any[] = Array.isArray(out.steps) ? out.steps : [];
    const steps = rawSteps
      .filter((s) => s && typeof s === "object")
      .map((s, idx) => {
        const segId = findQuoteSegment(String(s.quote ?? ""), segments);
        const dl = String(s.deadline ?? "");
        return {
          order: idx + 1,
          text: String(s.text ?? "").trim(),
          deadline: isISODate(dl) ? dl : parseHumanDate(dl),
          citations: segId ? [segId] : [],
        };
      })
      .filter((s) => s.text)
      .slice(0, 6);

    // reminder date must trace to a date the document actually states
    const knownDates = new Set(facts.filter((f) => f.date).map((f) => f.date as string));
    const r = out.reminder;
    const dueRaw = r ? String(r.due_at ?? "") : "";
    const due = isISODate(dueRaw) ? dueRaw : parseHumanDate(dueRaw);
    const reminderOk =
      r && due && (knownDates.has(due) || [...knownDates].some((kd) => due <= kd));

    const whatMatters = (Array.isArray(out.what_matters) ? out.what_matters : [])
      .map((s: unknown) => String(s))
      .filter((s: string) => s && !BANNED_ELIGIBILITY.test(s))
      .slice(0, 4);

    const grounded = facts.filter((f) => f.verification === "verified").length;

    res.status(200).json({
      ok: true,
      analysis: {
        title: String(out.title ?? "Untitled document"),
        docType: String(out.doc_type ?? "other"),
        issuer: String(out.issuer ?? "Unknown issuer"),
        recipient: String(out.recipient ?? ""),
        language: String(out.language ?? "en").slice(0, 2).toLowerCase(),
        summary: String(out.summary ?? "").trim(),
        whatMatters,
        transcript,
        segments,
        facts,
        steps,
        missing: (Array.isArray(out.missing) ? out.missing : []).map((s: unknown) => String(s)).slice(0, 5),
        needsConfirmation: (Array.isArray(out.needs_confirmation) ? out.needs_confirmation : [])
          .map((s: unknown) => String(s))
          .slice(0, 5),
        reminder: reminderOk
          ? { title: String(r.title ?? "Deadline"), dueAt: due as string, reason: String(r.reason ?? "") }
          : null,
        stats: { factCount: facts.length, grounded, stepCount: steps.length },
      },
    });
  } catch (e) {
    const status = e instanceof HostedError && e.kind === "timeout" ? 504 : 502;
    res.status(status).json(errorBody(e, cfg.apiKey));
  }
}
