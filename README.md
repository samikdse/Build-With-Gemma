# PlainDocs

**Understand healthcare paperwork instantly.** Upload a letter, form or notice — get a
plain-language explanation, a translation into your language, numbered action steps,
possible coverage matches, and reminders for the dates that matter.

Built for the **Build With Gemma** hackathon (Track 1: Clinical Triage — Healthcare under
Pressure), aimed at the paperwork side of healthcare pressure: confusion, administrative
burden and missed coverage opportunities.

> **Demonstration only.** Every document, person, program, policy number and amount in
> this app is synthetic. No real personal information. PlainDocs never claims confirmed
> eligibility — official programs decide.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # vitest — fixture/citation integrity, provider behaviour, safety language
npm run build      # type-check + production build (dist/)
npm run preview    # serve the production build
```

No backend, no keys, no network calls — the demo is fully deterministic. Deploys to
Vercel as a static Vite app (`npm run build`, output `dist/`).

## What's in the demo

| Surface | What it shows |
|---|---|
| **Home** | Recent documents, upcoming deadlines, coverage opportunities, attention items |
| **Upload** | File/photo upload (camera-capable on phones), demo shortcuts, live 6-agent pipeline |
| **Document view** | Original beside results: overview, plain language, translation, action steps, extracted facts, coverage insights, source text |
| **My Documents** | Search across titles, facts and full text |
| **Coverage** | Possible program matches with "why", missing info, application steps, disclaimers |
| **Reminders** | Create/edit/complete/delete; one-click suggestions from documents |
| **Ask PlainDocs** | Grounded Q&A with clickable citations and honest "not found" |

Every generated claim links to a source segment; clicking a citation opens the document's
source text with the exact passage highlighted. **Reset demo** (top bar) restores the
starting state at any time.

## Three-minute demo click path

1. **Home** — point out the preloaded benefits letter, the deadline list, and the amber
   "needs attention" row. (15s)
2. Top bar → switch language to **Español**. (5s)
3. **Upload a document** → **📷 Sample: photographed dental form** → watch the six-agent
   pipeline (Document → Translation → Plain-Language → Coverage → Action → Verification)
   with live logs. (25s)
4. Result page — read the verification banner ("11 claims checked, 0 unsupported").
   Overview shows a **connection to the benefits letter** (it *is* the required proof of
   no-dental-coverage). (30s)
5. **Translation** tab — full Spanish explanation + numbered steps. (15s)
6. Overview → **Set reminder** on the suggested Sept 23 deadline. (10s)
7. **Coverage insights** tab — "You may be eligible" for the dental program, with cited
   reasons, missing info, and the not-a-guarantee disclaimer. (20s)
8. **Ask PlainDocs** → "Is dental care included?" → answer cites both documents; click a
   citation → source text opens with the passage highlighted. Ask something not in the
   documents → honest "not found". (30s)
9. **Reminder centre** — the reminder is there; mark done/edit/delete. (10s)
10. Close: architecture slide — six Gemma agent roles behind one provider interface;
    fixtures today, local Gemma next; verification strips unsupported claims. (20s)

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

## Live Gemma integration order (next phase — not yet implemented)

1. **Document Agent** — Gemma 3 multimodal (Ollama, `gemma3:4b`+): image/PDF → structured
   facts via schema-constrained JSON output. Highest value, hardest to fake.
2. **Verification Agent** — re-check each generated claim against source segments;
   strip uncited claims. Do this second so every later agent inherits the safety net.
3. **Ask PlainDocs** — EmbeddingGemma retrieval over segments + grounded answering with
   mandatory citations and a NOT_FOUND sentinel.
4. **Translation + Plain-Language Agents** — on-demand for all eight languages.
5. **Coverage + Action Agents** — matching against the program KB; tool call
   (`create_reminder`) for reminder suggestions.

Wiring point: `src/services/index.ts` — swap `fixtureProvider` for `new GemmaProvider()`.
Config: copy `.env.example` → `.env`.

## License

MIT — see [LICENSE](LICENSE).
