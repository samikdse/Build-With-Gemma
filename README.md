# CareLens

**Understand your healthcare documents.** Upload a letter, form or notice — get a
plain-language explanation, a translation into your language, numbered action steps,
possible coverage matches, and reminders for the dates that matter.

Built for the **Build With Gemma** hackathon (Track 1: Clinical Triage — Healthcare under
Pressure), aimed at the paperwork side of healthcare pressure: confusion, administrative
burden and missed coverage opportunities.

> **Demonstration only.** Every document, person, program, policy number and amount in
> this app is synthetic. No real personal information. CareLens never claims confirmed
> eligibility — official programs decide.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # vitest — deterministic suites + live Gemma evals (skip if Ollama is down)
npm run build      # type-check + production build (dist/)
npm run preview    # serve the production build
```

The app works with **zero setup** on deterministic fixtures. To run the live Gemma
pipeline:

```bash
winget install Ollama.Ollama
ollama pull gemma3:4b
ollama pull embeddinggemma:300m
ollama serve
```

Then reload the app — the header chip flips to **"Gemma live · gemma3:4b"**. All
inference is local; no data leaves the machine, no API keys needed. Environment
variables (all optional, see `.env.example`): `VITE_GEMMA_BASE_URL`,
`VITE_GEMMA_MODEL`, `VITE_EMBED_MODEL`, `VITE_GEMMA_TIMEOUT_MS`,
`VITE_ENGINE=fixtures` (force-off switch), `VITE_GEMMA_API_KEY` (hosted endpoints
only — never committed).

### Reliability hierarchy (non-negotiable)

1. **Live Gemma** — used whenever Ollama is reachable.
2. **Validated cached output** — if a live call fails on a *built-in sample*, the
   deterministic fixture result is served, clearly labeled "validated demo cache".
3. **Recoverable error** — a user's *own* document never silently falls back to demo
   content (that would fabricate results); they get a clear error with Retry /
   use-a-sample options. No endless spinners anywhere.

### Which model does what

| Call | Model | Stage |
|---|---|---|
| Document/image reading + fact extraction (schema-constrained JSON, verbatim quotes) | **gemma3:4b** (multimodal) | 1–2 |
| Translation (names/dates/amounts preserved) | **gemma3:4b** | 3 |
| Plain-language simplification | **gemma3:4b** | 4 |
| Question + corpus embedding, multilingual retrieval | **embeddinggemma:300m** | 5 |
| Coverage-match explanation (candidates pre-screened by code rules) | **gemma3:4b** | 6 |
| Action steps + `create_reminder` tool-call proposals | **gemma3:4b** | 7 |
| Claim verification verdicts | **gemma3:4b** | 8 |
| Grounded QA over retrieved passages | **gemma3:4b** | Ask |

Deterministic code (not the model) does: ingestion & chunking, quote→segment citation
grounding, program-rule screening, date/amount preservation checks, citation
validation, reminder-date guards, and banned-eligibility-phrase stripping.

### Known limitations (honest)

- This dev machine has no usable GPU (Intel UHD 620), so gemma3:4b runs on CPU:
  ~15–60s per stage, a full image analysis can take 2–4 minutes. The pipeline UI
  narrates every stage so the wait is legible; on any machine with a GPU it drops
  to seconds.
- gemma3:4b occasionally grounds only part of its extracted facts to verbatim
  quotes; ungrounded facts are shown as **uncertain**, never as verified.
- Demo translations cover the fixture languages; live translation covers all eight
  but quality varies with the 4B model — identifiers and amounts are checked
  deterministically after every translation.
- Reminders work fully inside the app. There is **no** email/SMS/push delivery.

## What's in the demo

| Surface | What it shows |
|---|---|
| **Home** | Recent documents, upcoming deadlines, coverage opportunities, attention items |
| **Upload** | File/photo upload (camera-capable on phones), demo shortcuts, live 6-agent pipeline |
| **Document view** | Original beside results: overview, plain language, translation, action steps, extracted facts, coverage insights, source text |
| **My Documents** | Search across titles, facts and full text |
| **Coverage** | Possible program matches with "why", missing info, application steps, disclaimers |
| **Reminders** | Create/edit/complete/delete; one-click suggestions from documents |
| **Ask CareLens** | Grounded Q&A with clickable citations and honest "not found" |

Every generated claim links to a source segment; clicking a citation opens the document's
source text with the exact passage highlighted. **Reset demo** (top bar) restores the
starting state at any time.

## Three-minute LIVE demo sequence

Pre-demo: `ollama serve` running, both models pulled, one warm-up call made (first
call after a cold start pays model-load time). Header chip must read **Gemma live**.

1. **Home** (10s) — preloaded benefits letter, deadlines, "needs attention". Point at
   the **Gemma live · gemma3:4b** chip: everything runs locally.
2. Top bar → **Español** (5s).
3. **Upload** → **📷 Sample: photographed dental form** (60–90s on CPU — narrate over
   it). The six agents report live: Document Agent transcribes the photo and counts
   grounded facts; Translation preserves amounts; Coverage screens programs in code
   then asks Gemma to explain; Action proposes a `create_reminder` tool call;
   Verification reports claims checked / flagged. *This is the centerpiece — the
   judges watch real multimodal inference with a verification gate.*
4. **Result page** (30s) — "analyzed live by Gemma" tag; facts marked *verified in
   source* vs *uncertain*; click a citation → exact passage highlights. Spanish
   translation tab. Confirm the proposed reminder (user-confirmed tool call).
5. **Ask CareLens** (30s) — "Is dental care included?" → EmbeddingGemma retrieves
   from the *earlier* benefits letter, Gemma answers with citations. Then ask
   something absent → **NOT_FOUND**, no guess.
6. **Fallback proof** (20s) — kill `ollama serve`, click the other sample: the app
   flips to "validated demo cache", clearly labeled, zero broken screens. Restart
   Ollama, chip goes green again.
7. Close (15s): one provider interface, eight stages, code decides / Gemma writes,
   unsupported claims never rendered as fact.

## Architecture

```
src/
├── types.ts                 # domain contracts: documents, facts, insights, reminders, agent runs
├── fixtures/                # synthetic demo data (documents, programs, ask answers)
├── services/
│   ├── provider.ts          # AnalysisProvider interface — the AI boundary
│   ├── fixtureProvider.ts   # deterministic implementation (this phase)
│   ├── gemmaProvider.ts     # live Gemma implementation (next phase, same interface)
│   ├── index.ts             # the one place the engine is chosen
│   └── store.tsx            # app state + localStorage persistence + demo reset
├── components/              # shell, agent pipeline, document preview, common atoms
└── pages/                   # Home, Upload, DocumentView, Documents, Coverage, Reminders, Ask
```

**Multi-agent design:** six specialized Gemma roles run as an *orchestrated pipeline*
(not an autonomous swarm): Document → Translation → Plain-Language → Coverage → Action →
Verification. The Verification Agent's contract is central: claims that can't be tied to
a source segment are removed or marked uncertain, and the UI shows the checked/kept
counts on every analysis.

## Gemma pipeline layout

```
src/services/
├── index.ts               # ResilientProvider: live → cached → recoverable error
├── gemmaProvider.ts       # the eight-stage live pipeline + grounded Ask
├── fixtureProvider.ts     # deterministic fallback (demo samples)
└── gemma/
    ├── config.ts          # model/env configuration layer
    ├── client.ts          # Ollama chat (schema-constrained) + embeddings + health
    ├── prompts.ts         # ALL system prompts, versioned (EXTRACT_V1 … ASK_V1)
    ├── schemas.ts         # JSON Schemas + validators that repair/reject output
    ├── ingest.ts          # Stage 1: text/PDF/image ingestion, chunking, quote grounding
    └── retrieval.ts       # Stage 5: EmbeddingGemma multilingual retrieval + vector cache

tests/
├── fixtures.test.ts       # citation integrity + safety language (always runs)
├── provider.test.ts       # fixture provider behaviour (always runs)
└── eval.gemma.test.ts     # LIVE eval suite — skips cleanly when Ollama is down
```

## License

MIT — see [LICENSE](LICENSE).
