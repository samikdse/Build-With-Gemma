# Clinical Flow — Implementation Blueprint

**Track 1: Clinical Triage (Healthcare under Pressure) · Build With Gemma**
Status: design locked, pre-implementation. No code to be written until Phase 0 begins.

> All patient data in this project is synthetic. No real patient information is used, stored, or transmitted.

---

## 1. Final Product Definition

**Clinical Flow is a live patient-state workspace for the emergency department.**

It reads everything already written about a patient — EMS run sheet, triage note, prior discharge summaries, medication list, allergy records, labs, ECG, nursing reassessments — and maintains **one structured, cited, versioned representation of that patient**. When anything changes, it shows exactly what changed, what conflicts, and what the clinician has not yet seen. It drafts the 30-second brief, the progress note, and the SBAR handoff for clinician approval.

**Positioning line:** *You're not missing information. You're missing the update.*

**What it does:** organizes existing information, tracks state changes over time, surfaces gaps and contradictions with sources, drafts documentation.

**What it explicitly does not do:** diagnose, prescribe, rank patients by clinical acuity, recommend treatment, or replace clinical judgment. Every generated artifact is labeled an AI draft and requires explicit clinician approval before it is treated as reviewed.

### The architectural spine

Everything in the product is a view or a diff of a single object.

```
                    ┌──────────────────────────┐
   documents  ──▶   │   PatientState  v1..vN   │   ◀── simulated events
   (Gemma            │  structured · cited ·    │
    extraction)      │  versioned · immutable   │
                    └────────────┬─────────────┘
                                 │
     ┌────────────┬──────────────┼──────────────┬────────────┐
     ▼            ▼              ▼              ▼            ▼
   Brief      Issues         What Changed     Ask         SBAR /
 render(s)  validate(s)   diff(s_n-1, s_n)  retrieve(s)  Progress Note
```

Six features, one engine. This is the claim the submission is built on.

### Division of labour: model vs. code

| Job | Owner | Why |
|---|---|---|
| Prose → structured facts | **Gemma** | Irreplaceable. This is the hard part. |
| Context-aware summarization | **Gemma** | Requires clinical relevance judgement. |
| Answering from retrieved passages | **Gemma** | Language understanding. |
| Narrating a change set | **Gemma** | Turning a diff into clinician-readable prose. |
| Note / SBAR generation | **Gemma** | Structured writing. |
| Merging facts into state | Code | Deterministic. |
| Detecting conflicts | Code | Set/date comparison. 100% reliable. |
| Diffing two states | Code | Must never miss an item. |
| Validating citations | Code | The model cannot be trusted to grade itself. |

Stated in one sentence for judges: **we use the model where it is irreplaceable, and code where code is more reliable.**

---

## 2. Exact User Flow

The demo path is a single unbroken sequence. Every step is a screen the judge sees.

1. **Dashboard.** Clinician sees 3 active ED patients. One row carries an amber attention chip: *"Allergy record conflict — unresolved."* Clicks **Margaret Chen, 72, Bed 4**.
2. **Workspace loads → Overview tab.** PatientState `v1` renders instantly from cache.
3. **30-Second Brief** displays: one-line summary, chief complaint, presentation-relevant history, active meds, allergies, current findings, outstanding items. Every critical line carries a source chip.
4. **Needs Attention** panel shows two information-state flags:
   - *Allergy records disagree* (amber)
   - *Medication list last reconciled 14 months ago* (amber)
5. **Missing / Conflicting** panel expands the allergy conflict: 2023 discharge summary asserts penicillin allergy; today's triage note asserts NKDA. Both sources linked. **No resolution is proposed.**
6. Clinician clicks the `[Discharge Summary ¶4]` chip → **Documents tab** opens that document, scrolls to and highlights the exact passage.
7. Clinician returns to Overview, opens **Ask the Chart**, types: *"Why is she on warfarin?"*
8. Answer streams in: two sentences, each with an inline citation, plus a Sources strip beneath. Clicking a citation opens the passage. Retrieval trace is viewable ("8 passages searched, 3 used").
9. Clinician asks a deliberately unanswerable question: *"What is her most recent echo ejection fraction?"* → **"Not found in the available records."** with the list of what was searched. This is a scored demo beat.
10. **Simulated event fires** (auto-timer or presenter-triggered). Toast: *"New result — Troponin I."* Overview badge increments.
11. Gemma extracts the new document → merges → **PatientState v2**. Deterministic differ produces a ChangeSet.
12. **What Changed** panel populates with timestamps: new critical lab, changed pain score, new task, consult still pending, and one *newly relevant* item — the pre-existing anticoagulation status is now flagged relevant because a new critical result intersects it.
13. Clinician types a rough update into **Documentation**: *"Pain now 8/10 radiating to left arm. SOB continues. Cardiology hasn't called back. Repeat troponin ordered."*
14. Gemma returns a structured **progress-note draft** — clearly labeled AI draft. New facts are appended to the timeline; the task list updates (`repeat troponin` added, `cardiology consult` still open and now overdue).
15. Clinician clicks **Approve** → note is marked clinician-reviewed with timestamp and attribution.
16. **Handoff tab** → Generate SBAR. Draft assembles from `PatientState v2` + ChangeSet + open tasks. Editable inline.
17. Clinician approves. Audit line records who approved what, when.

---

## 3. Screen-by-Screen UX

### 3.1 Emergency Department Dashboard

Dense table, no cards. Persistent synthetic-data banner pinned to the top of the app shell.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⚠ SYNTHETIC DEMONSTRATION DATA — NOT REAL PATIENT INFORMATION              │
├────────────────────────────────────────────────────────────────────────────┤
│ Emergency Department · 3 active            Gemma3:4b ● local   14:32       │
├─────┬──────────────────┬──────────────────┬───────────┬────────┬───────────┤
│ Bed │ Patient          │ Chief complaint  │ Status    │ Waiting│ Attention │
├─────┼──────────────────┼──────────────────┼───────────┼────────┼───────────┤
│  4  │ Chen, Margaret   │ Chest pain, SOB  │ Awaiting  │  1h04m │ ▲ Allergy │
│     │ 72 F             │                  │ cardiology│        │  conflict │
├─────┼──────────────────┼──────────────────┼───────────┼────────┼───────────┤
│  7  │ Okafor, Daniel   │ Ankle injury     │ Awaiting  │  0h38m │           │
│     │ 34 M             │                  │ imaging   │        │           │
├─────┼──────────────────┼──────────────────┼───────────┼────────┼───────────┤
│ 12  │ Reyes, Sofia     │ Migraine         │ Observation│ 2h11m │ ▲ Med list│
│     │ 58 F             │                  │           │        │  outdated │
└─────┴──────────────────┴──────────────────┴───────────┴────────┴───────────┘
```

Attention column rules — **information-state only**:
- Never encodes clinical severity or acuity.
- Every chip has a one-line plain explanation on hover.
- Chip categories: `unacknowledged result` · `record conflict` · `stale reconciliation` · `overdue open item`.

### 3.2 Patient Workspace

Persistent header across all tabs:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Chen, Margaret · 72 F · Bed 4        Chest pain, SOB      Arrived 13:28    │
│ Allergies: ⚠ CONFLICTING   Anticoag: Warfarin   State v2 · updated 14:31   │
├──────────┬───────────┬──────────────┬───────────────┬──────────────────────┤
│ Overview │ Documents │ Ask the Chart│ Documentation │ Handoff              │
└──────────┴───────────┴──────────────┴───────────────┴──────────────────────┘
```

The allergy field renders amber whenever unresolved conflict exists — the conflict is visible from every tab, not buried in a panel.

**Overview layout** — two columns, 62% / 38%, desktop-first, no horizontal scroll above 1280px.

| Left column | Right column |
|---|---|
| 30-Second Brief | Needs Attention |
| What Changed (since your last view) | Outstanding Tasks |
| Missing / Conflicting Information | Timeline (reverse chronological) |

Design rules:
- What Changed is **empty on first load** and appears only after `v2`. This makes the demo beat land — the panel visibly materializes.
- Every panel header carries a state-version stamp.
- Every AI-generated block carries a small `AI DRAFT` tag until approved.

### 3.3 Documents Viewer

Two-pane. Left: document list grouped by origin (Prehospital / ED / Prior encounters / Results). Right: rendered document with passage anchors.

- Deep-linkable: `/patient/:id/documents/:docId#p04`
- Arriving via a citation click scrolls the passage into view and applies a **left amber border + pale background wash**, not a highlighter-pen effect.
- Header shows document origin, author role, and authored timestamp — a document's *age* is a first-class clinical signal.

### 3.4 Ask the Chart

Deliberately not a chat window.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Ask the chart                                              [  Ask  ]      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Why is she on warfarin?                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  Suggested: recent med changes · prior clots · latest kidney function      │
├────────────────────────────────────────────────────────────────────────────┤
│  ANSWER                                                                    │
│  Warfarin was started after a pulmonary embolism documented during the     │
│  March 2023 admission. [Discharge Summary ¶4]  It was continued for        │
│  ongoing atrial fibrillation at cardiology follow-up. [Cardiology ¶2]      │
├────────────────────────────────────────────────────────────────────────────┤
│  SOURCES                                                                   │
│  ▸ Discharge Summary — 2023-03-14 — ¶4       ▸ Cardiology — 2023-05-02 ¶2 │
│  Searched 8 passages across 6 documents · 3 used            [trace ▾]      │
└────────────────────────────────────────────────────────────────────────────┘
```

- Answer area is a **document region**, not a message bubble. Previous Q&A collapses into a thin history strip.
- Not-found is a first-class, styled state — never an apology, never a guess.
- The retrieval trace is expandable. Engineers on the panel will open it.

### 3.5 Documentation

Left: rough input textarea + Generate. Right: structured draft with `AI DRAFT — REQUIRES CLINICIAN REVIEW` banner, per-section edit, and **Approve**. Below: an "extracted facts" list showing exactly which statements were pulled from the free text and where they were routed (timeline / tasks / vitals). Transparency over magic.

### 3.6 Handoff

Four labeled SBAR blocks, each editable, each showing which state version and change set it was built from. Approve action stamps the audit record. Copy-to-clipboard and print stylesheet.

### 3.7 Visual System

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F7F8FA` | app background |
| `--surface` | `#FFFFFF` | cards, panels |
| `--border` | `#E1E5EA` | 1px hairlines |
| `--text` | `#0F1E36` | primary dark navy |
| `--text-muted` | `#5A6B85` | metadata, timestamps |
| `--accent` | `#2C5FA8` | actions, links, citations |
| `--attention` | `#B26A00` | missing / conflicting / stale |
| `--critical` | `#B3261E` | unacknowledged critical results only |
| `--ok` | `#2E6B4F` | resolved / approved |

Type: Inter or IBM Plex Sans, 13px base, 1.45 line-height. Tabular numerals for all times, labs, vitals. Radius 4px maximum. Shadows only on overlays. Transitions ≤150ms, on opacity and background only — no slides, no springs. Timestamps always absolute + relative: `14:26 (6 min ago)`.

Explicitly banned: gradients, glow, robot or brain iconography, sparkle/AI shimmer, chat bubbles, oversized rounded cards, medical cross icons, emoji in clinical surfaces.

---

## 4. Data Model

All persisted as JSON. SQLite optional; flat files + in-memory index are sufficient and faster to build.

### Document & Passage

```jsonc
{
  "doc_id": "doc.discharge_2023_03",
  "patient_id": "pt.chen_margaret",
  "title": "Discharge Summary — Internal Medicine",
  "doc_type": "discharge_summary",   // ems_report | triage_note | med_list |
                                      // discharge_summary | consult_note |
                                      // lab_report | imaging_report | nursing_note
  "origin": "prior_encounter",        // prehospital | ed | prior_encounter | results
  "author_role": "Hospitalist",
  "authored_at": "2023-03-14T11:20:00Z",
  "ingested_at": "2026-08-01T13:28:00Z",
  "is_live_event": false,
  "passages": [
    {
      "passage_id": "doc.discharge_2023_03#p04",
      "ordinal": 4,
      "heading": "Hospital Course",
      "text": "CT pulmonary angiogram confirmed segmental pulmonary embolism...",
      "char_start": 812,
      "char_end": 1104
    }
  ]
}
```

Passage IDs are **stable and content-addressed at seed time**. Citation integrity depends on this.

### Fact — the atom of patient state

Every clinically meaningful assertion Gemma extracts becomes a Fact. Facts are never edited, only superseded.

```jsonc
{
  "fact_id": "f.0142",
  "category": "allergy",      // problem | medication | allergy | vital | result |
                              // procedure | social | task | narrative
  "key": "penicillin",
  "value": { "substance": "Penicillin", "reaction": "rash", "severity": "unknown" },
  "asserted_at": "2023-03-14T11:20:00Z",   // when the SOURCE asserted it
  "extracted_at": "2026-08-01T13:28:04Z",
  "confidence": 0.91,
  "provenance": ["doc.discharge_2023_03#p06"],
  "negated": false,           // true encodes explicit denial, e.g. NKDA
  "superseded_by": null
}
```

`negated` is what makes the allergy conflict detectable in code: one Fact asserts penicillin allergy, another asserts `negated: true` on the allergy category at a later timestamp. The detector compares them; it does not need to read English.

### PatientState — immutable, versioned

```jsonc
{
  "state_id": "st.chen.v2",
  "patient_id": "pt.chen_margaret",
  "version": 2,
  "created_at": "2026-08-01T14:31:12Z",
  "trigger": { "type": "event", "event_id": "ev.troponin_result" },
  "parent_version": 1,

  "demographics": { "name": "Margaret Chen", "age": 72, "sex": "F", "bed": "4" },
  "encounter": {
    "chief_complaint": "Chest pain and shortness of breath",
    "arrived_at": "2026-08-01T13:28:00Z",
    "status": "awaiting_cardiology"
  },
  "problems":    [ { "fact_id": "f.0101", "label": "Atrial fibrillation", "active": true } ],
  "medications": [ { "fact_id": "f.0110", "name": "Warfarin", "dose": "5 mg", "route": "PO",
                     "last_reconciled": "2025-06-02", "stale": true } ],
  "allergies":   { "status": "conflicting", "entries": ["f.0142", "f.0143"] },
  "vitals":      [ { "fact_id": "f.0160", "type": "pain_score", "value": 8,
                     "recorded_at": "2026-08-01T14:29:00Z" } ],
  "results":     [ { "fact_id": "f.0171", "name": "Troponin I", "value": 0.42, "unit": "ng/mL",
                     "flag": "critical", "resulted_at": "2026-08-01T14:26:00Z",
                     "acknowledged": false } ],
  "tasks":       [ "tk.cardiology_consult", "tk.repeat_troponin" ],
  "timeline":    [ "tl.0001", "tl.0002" ],
  "issues":      [ "is.allergy_conflict", "is.med_list_stale" ]
}
```

States are append-only. `v1` is never mutated when `v2` is created — this is what makes the diff trustworthy and the demo reproducible.

### Issue (missing / conflicting / outdated)

```jsonc
{
  "issue_id": "is.allergy_conflict",
  "type": "conflict",              // conflict | missing | outdated
  "severity": "attention",         // attention | critical
  "category": "allergy",
  "title": "Allergy records disagree",
  "detail": "A prior discharge summary documents a penicillin allergy. Today's triage note records no known drug allergies.",
  "sources": ["doc.discharge_2023_03#p06", "doc.triage_note#p02"],
  "detected_by": "rule:allergy_negation_mismatch",
  "resolution": null,              // system NEVER auto-resolves
  "resolved_by": null
}
```

### Task

```jsonc
{
  "task_id": "tk.cardiology_consult",
  "label": "Cardiology consultation",
  "status": "pending",             // pending | in_progress | complete | cancelled
  "opened_at": "2026-08-01T13:52:00Z",
  "due_by": "2026-08-01T14:22:00Z",
  "overdue": true,
  "source": "doc.triage_note#p05",
  "created_by": "extraction"       // extraction | clinician | rule
}
```

### TimelineEvent

```jsonc
{
  "event_id": "tl.0007",
  "at": "2026-08-01T14:26:00Z",
  "kind": "result",                // arrival | assessment | result | order |
                                   // medication | consult | note | status_change
  "label": "Troponin I returned — 0.42 ng/mL (critical)",
  "sources": ["doc.lab_troponin_2#p01"],
  "state_version": 2
}
```

### ChangeSet — the output of the differ

```jsonc
{
  "changeset_id": "cs.v1_v2",
  "from_version": 1,
  "to_version": 2,
  "computed_at": "2026-08-01T14:31:12Z",
  "changes": [
    { "type": "result_added",     "severity": "critical",
      "label": "Troponin I 0.42 ng/mL",
      "at": "2026-08-01T14:26:00Z", "sources": ["doc.lab_troponin_2#p01"] },
    { "type": "vital_changed",    "field": "pain_score", "from": 6, "to": 8,
      "at": "2026-08-01T14:29:00Z", "sources": ["doc.nursing_reassess#p02"] },
    { "type": "task_opened",      "task_id": "tk.repeat_troponin" },
    { "type": "task_overdue",     "task_id": "tk.cardiology_consult" },
    { "type": "newly_relevant",   "fact_id": "f.0110",
      "reason": "anticoagulation status intersects a new critical result" }
  ],
  "narrative": null   // filled by Gemma from this structure — never from raw documents
}
```

### AIOutput — every generated artifact

```jsonc
{
  "output_id": "ao.0031",
  "kind": "sbar",                  // brief | answer | change_narrative |
                                   // progress_note | sbar
  "patient_id": "pt.chen_margaret",
  "state_version": 2,
  "content": { },
  "citations": ["doc.lab_troponin_2#p01"],
  "citation_validation": { "claimed": 4, "valid": 4, "stripped": 0 },
  "model": "gemma3:4b",
  "generated_at": "2026-08-01T14:33:10Z",
  "latency_ms": 2140,
  "from_cache": false,
  "status": "draft",               // draft | approved | rejected
  "approved_by": null,
  "approved_at": null
}
```

Nothing generated is ever silently promoted to approved. The `status` field is the safety spine of the product.

---

## 5. Gemma Workflow and Prompts

### Runtime decision

**Ollama, local, OpenAI-compatible endpoint.** One code path; swap `GEMMA_BASE_URL` to point at a bigger machine or a hosted endpoint without touching application code.

- Generation: `gemma3:4b` for development, `gemma3:12b` for the final demo if ≥12 GB VRAM is available.
- Embeddings: `embeddinggemma:300m` — keeps the entire stack in the Gemma family, which is worth saying out loud to judges.
- **Structured extraction uses schema-constrained decoding** (Ollama `format` with a JSON schema). Malformed JSON becomes structurally impossible rather than something we retry-and-pray around.

Local inference is also the strongest healthcare argument available: **synthetic today, but the architecture never sends patient data off the box.** That directly answers TRACKS.md's call for "localized clinical assistant tools."

### The five call types

| # | Call | When | Input | Output | Cached? |
|---|---|---|---|---|---|
| G1 | Extract | seed + on each event | one document | Facts[] | yes, at seed |
| G2 | Brief | state version change | PatientState | Brief JSON | yes for v1 |
| G3 | Ask | clinician query | query + retrieved passages | cited answer | no |
| G4 | Change narrative | after diff | ChangeSet | prose | no |
| G5 | Note / SBAR | on request | state + diff + clinician text | structured draft | no |

Critical timing property: **G1 runs at seed for all 8 documents.** During the live demo only one small document is extracted (the event), and G3/G4/G5 are short generations. Nothing long-running happens on stage.

### G1 — Extraction

```
SYSTEM
You are a clinical information extraction system. You convert clinical documents
into structured facts. You do not interpret, diagnose, or infer.

RULES
- Extract only what the document explicitly states.
- Never infer a diagnosis, severity, or causal relationship.
- Every fact must cite the passage_id it came from.
- If a document explicitly denies something (for example "no known drug
  allergies"), emit a fact with negated=true. Do not omit it.
- Use the document's own authored timestamp as asserted_at.
- If a value is ambiguous, lower the confidence. Do not guess.

DOCUMENT
type: {doc_type}   authored: {authored_at}   author: {author_role}
{passages rendered as [passage_id] heading: text}

Return JSON conforming to the provided schema.
```

The negation rule is load-bearing. "No known drug allergies" must survive as a *positive assertion of absence*, or the conflict detector has nothing to compare against.

### G2 — Brief

```
SYSTEM
You write the 30-second verbal brief an emergency clinician gives when handing
a patient to a colleague. You organize existing information. You never diagnose,
never recommend treatment, and never state a likelihood of any condition.

RELEVANCE RULE
Include a historical item only if it plausibly relates to the CURRENT
presentation, changes how existing information should be read, or is an
unresolved safety issue. Omit unrelated history entirely. A brief that
summarizes the whole chart is a failed brief.

CONSTRAINTS
- Every clinical claim carries [passage_id].
- If allergies are conflicting, say "conflicting" — never pick one.
- Do not restate anything not present in the state below.

PATIENT STATE (v{version})
{state json}

Return JSON: { one_liner, chief_complaint, relevant_history[],
               active_medications[], allergies, current_findings[],
               outstanding[] } — each entry { text, sources[] }.
```

### G3 — Ask the Chart

```
SYSTEM
You answer questions about a patient using ONLY the passages provided.

RULES
- Use only the passages below. You have no other knowledge of this patient.
- Every sentence must end with one or more [passage_id] citations.
- If the passages do not contain the answer, reply exactly:
  NOT_FOUND: <one line naming what would be needed to answer>
- Never infer, never generalize from medical knowledge, never diagnose.
- Two sentences maximum unless the question requires enumeration.

QUESTION
{query}

PASSAGES
[{passage_id}] ({doc_title}, {authored_at})
{text}
...
```

`NOT_FOUND` as a literal sentinel makes the not-found path a parsed state rather than a string-matched guess.

### G4 — Change narrative

```
SYSTEM
You describe what changed in a patient's record between two points in time.
You are given a computed change set. Describe ONLY these changes.

RULES
- Do not add, infer, or interpret any change not in the list.
- Do not suggest what the changes mean clinically.
- Lead with the change carrying severity "critical", if any.
- Use absolute timestamps.
- One short sentence per change.

CHANGE SET (v{from} → v{to})
{changeset json}
```

Gemma never sees the raw documents here. It cannot invent a change, because it is narrating a data structure produced by code.

### G5 — Progress note / SBAR

```
SYSTEM
You draft clinical documentation for clinician review. Your output is always a
draft and is never final.

RULES
- Use only the patient state, the change set, and the clinician's own words.
- Never write an assessment, differential, impression, or plan that the
  clinician did not state.
- If the clinician's text implies but does not state something, omit it.
- Preserve the clinician's clinical wording verbatim where possible.
- Mark any field you could not populate as "[not documented]".

PATIENT STATE v{version} / CHANGE SET / CLINICIAN INPUT
{...}

Return JSON: SBAR → { situation, background, assessment, recommendation,
outstanding_tasks[] }; progress note → { subjective, objective, updates,
tasks[], extracted_facts[] }.
```

`[not documented]` rather than plausible filler is the single highest-value anti-hallucination rule in the whole system, and it is visible in the UI.

### Constrained tool use — Ask the Chart only

Four tools, exposed nowhere else:

| Tool | Purpose |
|---|---|
| `search_patient_records(query, k)` | semantic + lexical passage retrieval |
| `get_medications()` | current med list with reconciliation dates |
| `get_allergies()` | allergy facts including negations and conflict status |
| `get_recent_results(since)` | labs/imaging with flags and acknowledgement state |

**Retrieval always runs before the model is called, regardless of tool selection.** If Gemma calls nothing, or calls the wrong tool, the answer still has good passages in context and degrades to ordinary RAG. There is no code path where a bad tool choice produces an empty screen.

*(Cut list note: `compare_patient_states`, `get_patient_timeline`, `get_pending_tasks`, and `add_timeline_event` from the original spec are deliberately not exposed as model-callable tools. They exist as internal functions invoked by deterministic pipelines. Making them agent-callable adds failure surface and buys nothing on stage.)*

---

## 6. Retrieval and Source Citation

### Index

Roughly 8 documents → ~60–90 passages for the main patient. Small enough that retrieval quality is easy and latency is negligible.

- Chunk at document-section boundaries, 80–200 tokens, never splitting a lab table row or a medication line.
- Each passage carries `doc_title`, `doc_type`, `authored_at`, `heading` — the model sees document age, which matters clinically.

### Hybrid search

```
BM25 (rank_bm25)          ─┐
                           ├─▶ Reciprocal Rank Fusion (k=60) ─▶ top 8 passages
EmbeddingGemma cosine     ─┘
```

BM25 catches drug names and exact clinical terms that embeddings blur; embeddings catch paraphrase ("blood clot" → "pulmonary embolism"). RRF needs no tuning and no score normalization — the right choice under time pressure.

**Category pinning:** allergy-, medication-, and result-related queries always pin the corresponding structured facts into context in addition to retrieved passages. A question about allergies must never depend on a retrieval hit.

### Citation validation — the layer worth demoing

Every generated artifact passes through validation before it reaches the UI:

1. Parse all `[passage_id]` markers from the output.
2. Assert each ID exists in the corpus. → unknown IDs are **stripped**.
3. Assert each ID was in the retrieved set for this call. → out-of-context IDs are **stripped**.
4. Any sentence left with zero citations is tagged `unsourced` and rendered in muted text with a small "no source" marker, or dropped entirely for the Brief.
5. Record `{claimed, valid, stripped}` on the AIOutput.

This is the answer to the question every AI practitioner on the panel will ask: *"how do you know it isn't making up the citations?"* The answer is that we check, mechanically, every time, and we show the counter.

### Rendering

`[doc.discharge_2023_03#p04]` → chip reading `Discharge Summary ¶4`, hover shows the passage text and its authored date, click deep-links to the highlighted passage in the Documents tab.

---

## 7. Frontend Component Structure

React 18 + Vite + TypeScript. TanStack Query for server state. Zustand for the small amount of UI state. Tailwind with the token set above mapped to CSS variables. No component library — clinical density is easier to hand-build than to fight a design system for.

```
frontend/src/
├── main.tsx
├── App.tsx                         # router + app shell
├── api/
│   ├── client.ts                   # fetch wrapper, error normalization
│   ├── queries.ts                  # TanStack Query hooks
│   └── sse.ts                      # event stream + answer streaming
├── stores/
│   ├── useEventStore.ts            # live events, unseen counters
│   └── useCitationStore.ts         # active citation → document deep-link
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   ├── SyntheticDataBanner.tsx
│   │   └── ModelStatusChip.tsx     # gemma3:4b ● local · p50 latency
│   ├── dashboard/
│   │   ├── PatientTable.tsx
│   │   ├── AttentionChip.tsx
│   │   └── WaitingClock.tsx
│   ├── patient/
│   │   ├── PatientHeader.tsx
│   │   ├── WorkspaceTabs.tsx
│   │   └── overview/
│   │       ├── BriefPanel.tsx
│   │       ├── NeedsAttentionPanel.tsx
│   │       ├── WhatChangedPanel.tsx
│   │       ├── IssuesPanel.tsx      # missing / conflicting / outdated
│   │       ├── TasksPanel.tsx
│   │       └── TimelinePanel.tsx
│   ├── documents/
│   │   ├── DocumentList.tsx
│   │   ├── DocumentViewer.tsx
│   │   └── PassageHighlight.tsx
│   ├── ask/
│   │   ├── AskPanel.tsx
│   │   ├── AnswerBlock.tsx
│   │   ├── SourceStrip.tsx
│   │   ├── NotFoundState.tsx
│   │   └── RetrievalTrace.tsx
│   ├── documentation/
│   │   ├── RoughNoteInput.tsx
│   │   ├── ProgressNoteDraft.tsx
│   │   └── ExtractedFactsList.tsx
│   ├── handoff/
│   │   ├── SbarDraft.tsx
│   │   └── SbarSection.tsx
│   └── common/
│       ├── CitationChip.tsx        # the most-reused component in the app
│       ├── AiDraftBanner.tsx
│       ├── ApprovalBar.tsx
│       ├── Timestamp.tsx           # absolute + relative, tabular numerals
│       ├── StateVersionBadge.tsx
│       └── Panel.tsx
├── types/                          # mirrors backend schemas exactly
└── styles/tokens.css
```

`CitationChip`, `Timestamp`, and `AiDraftBanner` are the components that make the app read as clinical software. Build them first and well.

---

## 8. Backend API Routes

FastAPI. Chosen over Node because the extraction, retrieval, and diff logic are all Python-shaped, and `rank_bm25` + numpy are one-line dependencies.

```
GET    /api/health                       # + gemma reachability, model name, p50 latency
GET    /api/patients                     # dashboard rows incl. attention chips
GET    /api/patients/{pid}
GET    /api/patients/{pid}/state         # ?version= (default latest)
GET    /api/patients/{pid}/state/versions

GET    /api/patients/{pid}/documents
GET    /api/documents/{doc_id}           # full doc + passages
GET    /api/passages/{passage_id}        # single passage, for hover previews

GET    /api/patients/{pid}/brief         # cached per state version
GET    /api/patients/{pid}/issues        # conflicts / missing / outdated
GET    /api/patients/{pid}/tasks
PATCH  /api/tasks/{task_id}              # status updates
GET    /api/patients/{pid}/timeline

POST   /api/patients/{pid}/ask           # SSE stream: tokens, then sources, then trace
GET    /api/patients/{pid}/changes       # ?since_version=N → ChangeSet + narrative

GET    /api/patients/{pid}/events/stream # SSE: live event pushes
POST   /api/patients/{pid}/events/inject # {event_id} — presenter-triggered
POST   /api/patients/{pid}/events/reset  # restore to v1 — REHEARSAL CRITICAL

POST   /api/patients/{pid}/notes/draft   # {rough_text} → progress note draft
POST   /api/patients/{pid}/handoff/draft # → SBAR draft
POST   /api/outputs/{output_id}/approve  # {approved_by}
GET    /api/patients/{pid}/audit         # approval trail
```

`events/reset` is not a nice-to-have. It is what lets the demo be run five times in a row at a judging table without restarting the server.

Backend layout:

```
backend/
├── app.py                  # FastAPI app, CORS, router mounting
├── config.py               # env: GEMMA_BASE_URL, GEMMA_MODEL, USE_CACHE
├── routers/
│   ├── patients.py  documents.py  ask.py  events.py  documentation.py  health.py
├── core/
│   ├── gemma.py            # Ollama client: chat, stream, schema-constrained JSON
│   ├── prompts.py          # G1–G5 templates, versioned
│   ├── extraction.py       # G1 pipeline, document → Facts[]
│   ├── state.py            # Fact merge → PatientState, version management
│   ├── differ.py           # ChangeSet computation — pure, unit-tested
│   ├── issues.py           # conflict / missing / outdated rule engine
│   ├── retrieval.py        # BM25 + EmbeddingGemma + RRF
│   ├── citations.py        # parse, validate, strip, count
│   └── events.py           # scripted event scheduler
├── models/                 # pydantic schemas, source of truth for both ends
├── data/
│   ├── patients/chen_margaret/documents/*.md
│   ├── patients/chen_margaret/events.json
│   ├── patients/okafor_daniel/…    (shallow)
│   ├── patients/reyes_sofia/…      (shallow)
│   └── cache/                      # precomputed G1/G2 outputs, committed to git
└── tests/
    ├── test_differ.py      # the differ must never miss a change
    ├── test_issues.py      # allergy conflict must always fire
    └── test_citations.py   # fabricated IDs must always be stripped
```

Three test files, not more. They cover the three things whose silent failure would break the demo.

---

## 9. Synthetic Patient Documents

**Margaret Chen, 72 F — Bed 4** (fully built). Two others exist as dashboard rows with a brief and 2–3 documents each; they are never opened on stage.

| # | Document | Authored | Carries |
|---|---|---|---|
| 1 | EMS Run Sheet | today 13:10 | Chest pain onset 12:40, SOB, initial vitals, aspirin given en route, "patient reports blood thinner" |
| 2 | ED Triage Note | today 13:28 | Chief complaint, pain 6/10, **"No known drug allergies"** ← conflict source A |
| 3 | Medication List | **2025-06-02** | Warfarin 5mg, metoprolol 25mg BID — **14 months stale** ← staleness source |
| 4 | Discharge Summary — Internal Medicine | 2023-03-14 | Segmental PE on CTPA, warfarin initiated, **penicillin allergy (rash)** ← conflict source B |
| 5 | Cardiology Follow-up | 2023-05-02 | AF confirmed, rate control, anticoagulation continued, "why warfarin" answer lives here |
| 6 | Initial Labs | today 13:55 | CBC, BMP (creatinine → kidney-function question), **troponin: PENDING** |
| 7 | ECG Report | today 13:41 | Rate-controlled AF, no acute ST elevation, non-specific changes |
| 8 | Nursing Reassessment | today 14:29 | *(arrives as live event)* Pain 8/10 radiating to left arm, SOB persists |
| 9 | Lab Result — Troponin I | today 14:26 | *(arrives as live event)* **0.42 ng/mL, CRITICAL flag** |

Each document is markdown with explicit section headings that become passage boundaries. Every one carries a `<!-- SYNTHETIC -->` marker in source.

Deliberate structure in the data:
- **Conflict** — docs 2 vs 4, resolvable by neither system nor demo. Shown, never decided.
- **Staleness** — doc 3's date is the entire point of that document.
- **Answerable question** — "why warfarin" needs docs 4 + 5 together, proving multi-document synthesis.
- **Unanswerable question** — no echocardiogram exists anywhere in the corpus. "What's her ejection fraction?" must return NOT_FOUND. This is planted.
- **Newly relevant** — warfarin is unremarkable in `v1`; when a critical troponin lands in `v2`, anticoagulation status becomes relevant. The differ emits `newly_relevant`. This is the most sophisticated beat in the demo and it comes from the data design, not from model cleverness.

---

## 10. Simulated Live-Event System

```jsonc
// events.json
[
  { "event_id": "ev.troponin_result",
    "fires_at_offset_s": 180,
    "document": "lab_troponin_2.md",
    "toast": "New result — Troponin I",
    "severity": "critical" },
  { "event_id": "ev.nursing_reassess",
    "fires_at_offset_s": 195,
    "document": "nursing_reassess.md",
    "toast": "Nursing reassessment filed",
    "severity": "attention" }
]
```

Pipeline on fire:

```
event fires
  → document appended to corpus, is_live_event=true
  → passages indexed (BM25 + embeddings)
  → G1 extraction on that ONE document          (~1–2s, 4b)
  → facts merged → PatientState v2 created      (deterministic)
  → differ(v1, v2) → ChangeSet                  (deterministic)
  → G4 narrative from ChangeSet                 (~1s)
  → SSE push to client → toast + panel populate
```

**Control:** timer for the rehearsed run, plus a hidden presenter control (`?presenter=1` reveals inject/reset buttons). Never rely on a timer alone in front of judges — if the story runs long, the event should fire on a keypress.

**Reset** restores `v1`, drops live documents, clears the index delta. Sub-second, repeatable, no restart.

---

## 11. Safest Achievable MVP

The demo-critical core, in dependency order. If only this ships, the submission is still strong:

1. Seeded synthetic corpus with stable passage IDs.
2. Precomputed extraction → `PatientState v1` (Gemma at seed, cached to disk).
3. Dashboard + Patient Workspace shell + Documents viewer with passage highlighting.
4. Brief panel with working citation chips.
5. Issues panel with the allergy conflict and med staleness (rule-detected).
6. Ask the Chart: hybrid retrieval → cited answer → validated citations → NOT_FOUND state.
7. Event injection → `v2` → deterministic ChangeSet → What Changed panel.
8. SBAR draft + approval.

Progress-note generation is the first thing outside this ring.

### Reliability architecture

Three independent layers, because a local model on demo WiFi is a real risk:

| Layer | Behaviour |
|---|---|
| **Cache** | Every G1/G2 output for Margaret Chen is precomputed and **committed to the repo**. `USE_CACHE=true` serves them instantly. |
| **Live** | Ask, change narrative, and SBAR always hit Gemma live — the judges must see real inference. |
| **Fallback** | Any live call that fails or exceeds 8s falls back to a cached response with a visible `cached response` chip. Honest, not hidden. |

The rule: **never fake live inference, never let a failure produce a blank screen.** A visible "cached" chip costs nothing in judging and a spinner-of-death costs everything.

---

## 12. Prioritized Build Order

Assumes ~40 working hours across the team. Frontend and backend parallelize after Phase 1.

| Phase | Hours | Deliverable | Gate |
|---|---|---|---|
| **0 · Foundations** | 4 | Repo scaffolding, Vite+FastAPI running together, tokens/CSS, pydantic schemas shared both ends, Ollama reachable | `/api/health` green, tokens render |
| **1 · Data & state (no AI)** | 6 | All 9 documents authored, passage chunking, hand-written `v1`/`v2` state fixtures, differ + issue rules with unit tests | Differ passes tests against fixtures |
| **2 · UI skeleton on real data** | 6 | Dashboard, workspace shell, Documents viewer, citation deep-link + highlight, Brief/Issues/Tasks/Timeline panels rendering fixtures | Whole app navigable with zero AI |
| **3 · Gemma extraction** | 5 | G1 with schema-constrained decoding, fact merge, real `v1` generated from documents, cache written to disk | Generated `v1` matches fixture semantically |
| **4 · Ask the Chart** | 6 | BM25 + EmbeddingGemma + RRF, G3, citation validation, SSE streaming, NOT_FOUND, retrieval trace | Planted unanswerable question returns NOT_FOUND |
| **5 · Live events** | 5 | Event scheduler, SSE, incremental extraction, `v2`, ChangeSet, G4 narrative, What Changed panel, reset | Full inject→reset loop repeatable 5× |
| **6 · Documentation & SBAR** | 4 | G5, progress-note draft, extracted-facts list, SBAR, approval + audit | Approve stamps audit record |
| **7 · Polish & harden** | 4 | Fallback layer, loading skeletons, empty states, latency chip, print stylesheet, README + architecture diagram | Demo run with Ollama stopped still completes |

**Phase 2 before Phase 3 is deliberate.** Building the UI against hand-written fixtures means the app is demoable from hour 16, and every AI phase after that is an upgrade rather than a dependency. If the team runs out of time at any point past Phase 2, there is still a working submission.

---

## 13. Cut List

**Already cut in this design — do not build:**

| Cut | Reason |
|---|---|
| PDF ingestion | Hours of parsing, zero demo seconds. Markdown gives exact passage anchors. |
| Voice dictation | Browser API flakiness + demo-room noise. Typing is the beat. |
| Free-form agentic tool selection | Unreliable at 4B under pressure. Constrained to 4 tools in Ask only. |
| Auth / users / multi-tenancy | Invisible to judges. |
| Database | JSON + in-memory index is sufficient at this scale. |
| Deep build-out of patients 2 and 3 | Dashboard rows only. |
| Model fine-tuning | No time, no data, no payoff. |
| Real-time collaboration | Out of scope. |

**Cut under time pressure, in this order:**

1. **Retrieval trace panel** — nice for engineers, not load-bearing.
2. **Extracted-facts list** in Documentation — the note draft alone carries the point.
3. **Progress-note generation entirely** — SBAR demonstrates the same capability. *(Biggest single time saving available.)*
4. **`newly_relevant` change type** — the most sophisticated beat, but the diff still lands without it.
5. **Audit trail view** — keep the approve action and the stamp; drop the history screen.
6. **Patients 2 and 3** — a one-patient dashboard is slightly odd but survivable.
7. **EmbeddingGemma** — fall back to BM25 only. At 9 documents, quality loss is small.

**Never cut, at any cost:** citation chips that open the highlighted passage · the allergy conflict · the What Changed panel · NOT_FOUND · the synthetic-data banner · AI-draft labelling and approval.

---

## 14. Three-Minute Demo Script

Presenter drives; a second person watches the console and holds the manual inject key.

| Time | Screen | Say |
|---|---|---|
| **0:00–0:20** | Dashboard | "An ED clinician picking up a patient spends the first several minutes reconstructing a story that's already written down — across EMS, triage, old discharge summaries, labs. The information isn't missing. It's scattered, and some of it contradicts itself." |
| **0:20–0:35** | Dashboard, hover the amber chip | "Clinical Flow reads all of it with Gemma running locally. It's flagging Bed 4 — not because it thinks she's sick, but because her allergy records disagree with each other. It flags information problems, never clinical conclusions." |
| **0:35–1:05** | Overview → Brief | "Open her: 30-second brief. 72, chest pain and shortness of breath, atrial fibrillation, prior pulmonary embolism, on warfarin. Note what it left out — this is scoped to the current presentation, not a chart summary. Every line is cited." |
| **1:05–1:25** | Click a citation | *(click)* "Sources are real. That opens the 2023 discharge summary and highlights the exact passage. And here's the conflict — that summary documents a penicillin allergy; today's triage note says no known allergies. It shows both. It does not pick one. That's a human decision." |
| **1:25–1:50** | Ask the Chart | "Ask it anything." Type **"Why is she on warfarin?"** → "Answered from two documents — the PE in 2023, continued for AF at cardiology follow-up. Both cited." Then type **"What's her most recent ejection fraction?"** → "Not found. There's no echo in this chart, and it says so instead of guessing. We validate every citation server-side — fabricated references get stripped before they reach the screen." |
| **1:50–2:25** | Event fires | *(toast)* "A troponin just resulted. Gemma extracts it, rebuilds the patient state, and we diff the two versions in code — so a change can't be missed. What Changed: critical troponin at 14:26, pain up from 6 to 8 radiating to the left arm, cardiology consult now overdue. And this line — her anticoagulation status just became newly relevant, because a new critical result intersects it." |
| **2:25–2:45** | Documentation → Handoff | Type the rough update → "Structured progress note, labeled a draft, requires approval." *(approve)* → Handoff tab → "SBAR for shift change, built from the current state and everything that's changed. Editable, and nothing is final until a clinician signs it." |
| **2:45–3:00** | Architecture slide | "Gemma 3 running locally — no patient data leaves the machine. Gemma does extraction, retrieval-grounded answering, and drafting. Comparison and conflict detection are deterministic code, so they can't hallucinate. One versioned patient state; every feature is a view or a diff of it. It organizes information. It never diagnoses." |

**Rehearsal rules:** run it end to end at least ten times. Run it once with Ollama killed — it must still complete via cache. Run it once on a phone hotspot. Have `events/reset` bound to a key. Never open a browser devtools panel on stage.

---

## 15. Final Folder Structure

```
Build-With-Gemma/
├── README.md                       # problem, demo GIF, architecture, run in 3 commands
├── LICENSE
├── TRACKS.md
├── .env.example                    # GEMMA_BASE_URL, GEMMA_MODEL, USE_CACHE
├── docker-compose.yml              # optional: api + ollama, one command
│
├── docs/
│   ├── BLUEPRINT.md                # this document
│   ├── ARCHITECTURE.md             # diagram + the model-vs-code table
│   ├── SAFETY.md                   # scope limits, non-diagnostic stance, synthetic data
│   └── DEMO_SCRIPT.md              # §14, printable
│
├── backend/
│   ├── app.py  config.py  requirements.txt
│   ├── routers/     patients.py documents.py ask.py events.py documentation.py health.py
│   ├── core/        gemma.py prompts.py extraction.py state.py differ.py
│   │                issues.py retrieval.py citations.py events.py
│   ├── models/      document.py fact.py patient_state.py changeset.py ai_output.py
│   ├── data/
│   │   ├── patients/
│   │   │   ├── chen_margaret/
│   │   │   │   ├── patient.json
│   │   │   │   ├── documents/    ems_run_sheet.md  triage_note.md  medication_list.md
│   │   │   │   │                 discharge_summary_2023.md  cardiology_followup_2023.md
│   │   │   │   │                 labs_initial.md  ecg_report.md
│   │   │   │   │                 lab_troponin_2.md  nursing_reassess.md
│   │   │   │   └── events.json
│   │   │   ├── okafor_daniel/    (shallow)
│   │   │   └── reyes_sofia/      (shallow)
│   │   └── cache/                # committed — precomputed extraction + brief
│   └── tests/       test_differ.py  test_issues.py  test_citations.py
│
└── frontend/
    ├── index.html  vite.config.ts  tailwind.config.ts  package.json
    └── src/                        # structure per §7
```

`backend/data/cache/` is committed to git deliberately. It is the difference between a demo that works on any laptop and one that depends on a model being warm.

---

## Open decisions requiring a call before Phase 0

1. **Model size for the final demo** — depends on the demo machine's VRAM. Build against `gemma3:4b`; upgrade to `12b` only if the hardware is confirmed and the cache is regenerated.
2. **Who presents** — the script assumes one presenter plus one operator. If solo, bind event injection to a keypress rather than a timer.
3. **Team split** — Phases 2 and 3 parallelize cleanly (UI on fixtures / extraction pipeline). Phase 1 does not; the state schema must be agreed by one person before anyone builds against it.
