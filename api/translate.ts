import { callGemma, errorBody, extractJSON, HostedError, readConfig } from "./_lib/hosted";

export const config = { maxDuration: 30 };

const TRANSLATE_PROMPT = (lang: string, summary: string, points: string[], steps: string[]) =>
  `You translate healthcare and benefits information into ${lang}. Accuracy beats fluency.

RULES
- NEVER translate or alter: person names, organization names, policy numbers, identifiers, phone numbers, emails, addresses, monetary amounts, percentages, or dates. Copy them character-for-character.
- Do not add information. Do not drop information. Do not soften obligations ("must" stays "must").
- If a term has no good translation, keep the original and add a short gloss in parentheses.

Return ONLY this JSON:
{"summary": string, "points": [string], "steps": [string]}

SUMMARY:
${summary}

IMPORTANT POINTS:
${points.map((p, i) => `${i + 1}. ${p}`).join("\n") || "(none)"}

NUMBERED ACTIONS:
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n") || "(none)"}`;

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
  const language = String(body.language ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  if (!language || !summary) {
    res.status(400).json({ ok: false, error: "Missing language or summary" });
    return;
  }
  const points: string[] = Array.isArray(body.points) ? body.points.map(String) : [];
  const steps: string[] = Array.isArray(body.steps) ? body.steps.map(String) : [];

  try {
    const raw = await callGemma(cfg, {
      prompt: TRANSLATE_PROMPT(language, summary, points, steps),
      maxTokens: 1600,
      timeoutMs: 25_000,
    });
    const out = extractJSON(raw);

    // deterministic preservation check — amounts/dates/ids must survive
    const source = [summary, ...points, ...steps].join(" ");
    const translated = [out.summary, ...(out.points ?? []), ...(out.steps ?? [])].join(" ");
    const tokens = source.match(/\$[\d,.]+|\d+%|\b\d{4}-\d{2}-\d{2}\b|\b1-\d{3}-\d{3}-\d{4}\b/g) ?? [];
    const lost = [...new Set(tokens)].filter((t) => !translated.includes(t));

    res.status(200).json({
      ok: true,
      translation: {
        summary: String(out.summary ?? "").trim(),
        points: (Array.isArray(out.points) ? out.points : []).map(String),
        steps: (Array.isArray(out.steps) ? out.steps : []).map(String),
        preservedAll: lost.length === 0,
        lostTokens: lost.slice(0, 5),
      },
    });
  } catch (e) {
    const status = e instanceof HostedError && e.kind === "timeout" ? 504 : 502;
    res.status(status).json(errorBody(e, cfg.apiKey));
  }
}
