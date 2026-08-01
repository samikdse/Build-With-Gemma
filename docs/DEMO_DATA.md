# Demo Data Guide — Margaret Chen

> All patient information in this project is **synthetic demonstration data**.
> No real patient information exists anywhere in this repository.

This file explains the demo patient's story, what is deliberately planted in
the data, and which outputs are cached versus generated live by Gemma.
Source of truth for the overall design: [BLUEPRINT.md](BLUEPRINT.md).

---

## The patient

**Margaret Chen** · 72 F · Bed 4 · MRN SYN-000142 (`pt.chen_margaret`)

Presents 2026-08-01 at 13:20 by EMS with central chest pressure and shortness
of breath, onset ~12:40. History: atrial fibrillation (2021), segmental
pulmonary embolism (March 2023), hypertension. Documented medications:
warfarin 5 mg daily, metoprolol tartrate 25 mg BID, amlodipine 5 mg daily.

## Document and event order

| # | doc_id | Authored | Role in the story |
|---|--------|----------|-------------------|
| 1 | `doc.discharge_2023_03` | 2023-03-14 | PE confirmed on CTPA; warfarin started; **penicillin allergy (rash)** — conflict side A |
| 2 | `doc.cardiology_2023_05` | 2023-05-02 | AF rate-controlled; warfarin continued; the "why warfarin" answer needs this + #1 |
| 3 | `doc.med_list` | 2025-06-02 | **~14 months stale** — the outdated-source flag |
| 4 | `doc.ems_run_sheet` | today 13:22 | Onset, prehospital vitals, aspirin given, "blood thinner" per patient |
| 5 | `doc.triage_note` | today 13:28 | Chief complaint; pain 6/10; **"No known drug allergies"** — conflict side B |
| 6 | `doc.ecg_report` | today 13:41 | AF ~96, no acute ST elevation |
| 7 | `doc.nursing_initial` | today 13:58 | 13:45 assessment/vitals; cardiology consult placed 13:52 |
| 8 | `doc.labs_initial` | today 13:55 | CBC/chemistry; **troponin PENDING**, collected 13:50 |
| 9 | `doc.nursing_reassess` | today 14:20 | **LIVE EVENT 1** → state v2: pain 8/10 radiating to left arm |
| 10 | `doc.lab_troponin_2` | today 14:26 | **LIVE EVENT 2** → state v3: troponin 0.42 ng/mL, lab-flagged critical |

Events fire per `backend/data/patients/chen_margaret/events.json`
(offsets 180 s and 240 s, or presenter-triggered).

**Deviation from BLUEPRINT §10:** the blueprint's example fired the troponin
before the nursing reassessment. The data uses nursing-first so the demo has
three clean state versions with one focused beat each (v2 = symptom change,
v3 = critical result). Simpler and more legible on stage.

## Planted information conditions

| Condition | Where | Expected behaviour |
|---|---|---|
| **Conflict** | `doc.discharge_2023_03#p05` (penicillin, rash) vs `doc.triage_note#p02` (NKDA) | Surface both sources; never decide which is correct. Detected in code by comparing a positive allergy fact against a `negated: true` allergy fact — see `backend/core/issues.py` |
| **Outdated** | `doc.med_list` dated 2025-06-02 | Flag "may be outdated" — never "incorrect" |
| **Missing 1** | No INR *value* anywhere (monitoring is *mentioned* in 2023 docs — realistic — but no number exists) | `is.inr_missing` fires because warfarin is documented |
| **Missing 2** | No echocardiogram / ejection fraction anywhere | `is.echo_missing` + the NOT_FOUND demo |
| **Missing 3** | No code status / advance directive anywhere | `is.code_status_missing` |
| **Newly relevant** | Warfarin (`drug_class: anticoagulant`) + v3's critical troponin | Differ emits `newly_relevant` — rule-driven, not model-driven |

Do **not** add an INR value, an echo mention, or a code status to any
document — tests in `backend/tests/test_citations.py` enforce their absence.

## Expected demo questions (Ask the Chart)

1. **"Why is she on warfarin?"** → answered from `doc.discharge_2023_03#p02/#p04` + `doc.cardiology_2023_05#p02` (multi-document synthesis)
2. **"Has she had a blood clot before?"** → answered from `doc.discharge_2023_03#p02` + `doc.ems_run_sheet#p05`
3. **"What is her most recent echocardiogram result?"** → **NOT_FOUND** — deliberately unanswerable; the planted absence

## State versions

- **v1** (13:58:30, seed): 8 documents, troponin pending, ECG done, all five
  information issues open, both tasks pending.
- **v2** (14:20:45, `ev.nursing_reassess`): pain 6→8 + left-arm radiation,
  vitals shift. Nothing else changes — the diff is exactly one story beat.
- **v3** (14:26:30, `ev.troponin_result`): troponin pending→0.42 critical
  (unacknowledged), initial-troponin task complete, cardiology consult
  overdue (placed 13:52, expected callback 14:22), warfarin newly relevant.

States are append-only fixtures in
`backend/data/patients/chen_margaret/fixtures/`. The differ
(`backend/core/differ.py`) computes v1→v2 and v2→v3 deterministically.

## Cached vs. live-by-Gemma

**Cached now, stays cached in the demo** (committed under `backend/data/cache/chen_margaret/`):

- `brief_v1` — 30-second brief
- `missing_information`, `issue_allergy_conflict`, `issue_med_list_stale`
- `outstanding_tasks_v3`

**Cached now as fixtures; produced LIVE by Gemma in later phases** (the
cached copies become the fallback layer, BLUEPRINT §11):

- `ask_why_warfarin`, `ask_prior_pe`, `ask_last_echo` — live in Phase 4 (G3)
- `changes_v1_v2`, `changes_v2_v3` — the *narrative* goes live in Phase 5 (G4);
  the underlying change list is always computed by code
- `sbar_v3` — live in Phase 6 (G5)

Extraction (G1) is precomputed at seed in Phase 3; `fixtures/facts.json` is
the hand-authored reference the generated extraction is checked against.

## Safety boundaries encoded in the data

No fixture or cached output diagnoses, recommends treatment, ranks acuity,
or resolves the allergy conflict. `backend/tests/test_fixtures.py` enforces a
banned-terms gate over every cached output and requires every SBAR statement
to carry sources. Attention indicators describe **information state only**
(unacknowledged result, record conflict, stale source, overdue item).
