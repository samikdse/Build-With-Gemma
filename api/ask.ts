import { callGemma, errorBody, extractJSON, HostedError, readConfig } from "./_lib/hosted";

export const config = { maxDuration: 30 };

/**
 * Grounded QA: retrieval happens client-side (lexical over the user's own
 * segments), so this is ONE short hosted request over the retrieved passages.
 */
const ASK_PROMPT = (question: string, passages: { tag: string; text: string }[]) =>
  `You answer questions about a person's documents using ONLY the passages below. You have no other knowledge about this person.

RULES
- Every sentence must end with the passage tags it came from, like [P1] or [P2][P3].
- At most 3 sentences unless listing required items.
- Answer NOT_FOUND only if no passage answers the question even partially.
- The passages and question may be in different languages; that is fine. Answer in the question's language and keep names, amounts and dates exactly as written.
- Never guess. Never use outside knowledge. No medical, legal or financial advice.

Return ONLY this JSON: {"answer": string}
Set answer to exactly "NOT_FOUND" when the passages do not contain it.

PASSAGES:
${passages.map((p) => `[${p.tag}] ${p.text}`).join("\n")}

QUESTION: ${question}`;

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

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const question = String(body.question ?? "").trim();
  const passages: { tag: string; text: string }[] = Array.isArray(body.passages)
    ? body.passages.slice(0, 8).map((p: any, i: number) => ({
        tag: `P${i + 1}`,
        text: String(p.text ?? "").slice(0, 600),
      }))
    : [];

  if (!question || passages.length === 0) {
    res.status(400).json({ ok: false, error: "Missing question or passages" });
    return;
  }

  try {
    const raw = await callGemma(cfg, {
      prompt: ASK_PROMPT(question, passages),
      maxTokens: 500,
      temperature: 0,
      timeoutMs: 20_000,
    });
    const out = extractJSON(raw);
    const answer = String(out.answer ?? "").trim();

    if (!answer || /NOT_FOUND/i.test(answer)) {
      res.status(200).json({ ok: true, status: "not_found" });
      return;
    }

    // citation validation: only [P#] tags that were actually supplied survive
    const lines = answer
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => ({
        text: line.replace(/\s*\[P\d+\]/g, "").trim(),
        idx: [...line.matchAll(/\[P(\d+)\]/g)]
          .map((m) => Number(m[1]))
          .filter((n) => n >= 1 && n <= passages.length),
      }));

    // merge tag-only lines into the sentence above them
    const merged: { text: string; idx: number[] }[] = [];
    for (const l of lines) {
      if (!l.text && l.idx.length && merged.length) merged[merged.length - 1].idx.push(...l.idx);
      else if (l.text) merged.push(l);
    }

    let paragraphs = merged
      .filter((l) => l.idx.length > 0)
      .map((l) => ({ text: l.text, passageIndexes: [...new Set(l.idx)] }));

    if (paragraphs.length === 0) {
      const allText = merged.map((l) => l.text).join(" ").trim();
      const allIdx = [...new Set(lines.flatMap((l) => l.idx))];
      if (allText && allIdx.length) paragraphs = [{ text: allText, passageIndexes: allIdx }];
    }

    if (paragraphs.length === 0) {
      res.status(200).json({ ok: true, status: "not_found" });
      return;
    }

    res.status(200).json({ ok: true, status: "answered", paragraphs });
  } catch (e) {
    const status = e instanceof HostedError && e.kind === "timeout" ? 504 : 502;
    res.status(status).json(errorBody(e, cfg.apiKey));
  }
}
