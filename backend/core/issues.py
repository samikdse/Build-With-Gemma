"""Deterministic information-issue detection.

Gemma does extraction; CODE does comparison (BLUEPRINT §1, §5). These rules
operate on structured facts and document metadata — never on free prose —
so the allergy conflict, staleness flag, and missing-information list fire
identically on every run.

Every issue is information-state only. No rule here encodes clinical
severity, acuity, or diagnosis.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.models import ClinicalDocument, ExtractedFact, InformationIssue

STALE_AFTER_DAYS = 365


# ------------------------------------------------------------- conflicts


def detect_allergy_conflict(facts: list[ExtractedFact]) -> Optional[InformationIssue]:
    """A positive allergy assertion coexisting with an explicit denial
    (negated fact) from a different source is a conflict.

    The system surfaces it and links both sources. It NEVER decides which
    record is correct — resolution stays None until a clinician acts.
    """
    allergy_facts = [f for f in facts if f.category == "allergy" and f.is_current]
    positives = [f for f in allergy_facts if not f.negated]
    denials = [f for f in allergy_facts if f.negated]

    if not positives or not denials:
        return None

    sources = []
    for f in positives + denials:
        sources.extend(f.provenance)

    substances = ", ".join(
        str(f.value.get("substance", f.key)) for f in positives
    )
    return InformationIssue(
        issue_id="is.allergy_conflict",
        type="conflict",
        severity="attention",
        category="allergy",
        title="Allergy records disagree",
        detail=(
            f"A prior record documents an allergy ({substances}) while a "
            "more recent record explicitly states no known drug allergies. "
            "Both sources are shown; confirmation with the patient or "
            "records is required."
        ),
        sources=sources,
        detected_by="rule:allergy_negation_mismatch",
    )


# ------------------------------------------------------------- staleness


def detect_stale_documents(
    corpus: dict[str, ClinicalDocument],
    now: datetime,
    doc_types: tuple[str, ...] = ("med_list",),
    stale_after_days: int = STALE_AFTER_DAYS,
) -> list[InformationIssue]:
    """Flag reference documents older than the staleness window.

    Flags that the information MAY be outdated — never that it is incorrect.
    """
    issues: list[InformationIssue] = []
    for doc in corpus.values():
        if doc.doc_type not in doc_types:
            continue
        authored = doc.authored_at
        if authored.tzinfo is None:
            authored = authored.replace(tzinfo=timezone.utc)
        age = now - authored
        if age > timedelta(days=stale_after_days):
            months = round(age.days / 30.44)
            issues.append(
                InformationIssue(
                    issue_id=f"is.{doc.doc_type}_stale",
                    type="outdated",
                    severity="attention",
                    category=doc.doc_type,
                    title="Medication list may be outdated",
                    detail=(
                        f"The most recent medication reconciliation on file is "
                        f"from {authored.date().isoformat()}, approximately "
                        f"{months} months before this encounter. It may not "
                        "reflect current medications."
                    ),
                    sources=[doc.passages[0].passage_id] if doc.passages else [],
                    detected_by="rule:document_age",
                )
            )
    return issues


# --------------------------------------------------------------- missing


def detect_missing_information(
    facts: list[ExtractedFact],
    corpus: dict[str, ClinicalDocument],
) -> list[InformationIssue]:
    """Rule-detected absences that are clinically relevant to reading this
    record. Each rule states WHY the absence matters, citing the passages
    that establish relevance — never inventing the missing value."""
    issues: list[InformationIssue] = []
    current = [f for f in facts if f.is_current]

    # 1. Anticoagulant documented but no INR result anywhere in the record.
    on_anticoagulant = [
        f for f in current
        if f.category == "medication"
        and f.value.get("drug_class") == "anticoagulant"
    ]
    has_inr_result = any(
        f.category == "result" and f.key == "inr" for f in current
    )
    if on_anticoagulant and not has_inr_result:
        issues.append(
            InformationIssue(
                issue_id="is.inr_missing",
                type="missing",
                severity="attention",
                category="result",
                title="No INR result on file",
                detail=(
                    "The record documents active warfarin therapy, but no "
                    "INR value appears in any available document for this "
                    "encounter."
                ),
                sources=sorted(
                    {pid for f in on_anticoagulant for pid in f.provenance}
                ),
                detected_by="rule:anticoagulant_without_inr",
            )
        )

    # 2. No echocardiogram report or result anywhere in the record.
    has_echo = any(
        "echocardiogram" in p.text.lower() or "ejection fraction" in p.text.lower()
        for doc in corpus.values()
        for p in doc.passages
    )
    if not has_echo:
        issues.append(
            InformationIssue(
                issue_id="is.echo_missing",
                type="missing",
                severity="attention",
                category="result",
                title="No echocardiogram report available",
                detail=(
                    "No echocardiogram report or ejection fraction value "
                    "appears in any available document."
                ),
                sources=[],
                detected_by="rule:no_echo_document",
            )
        )

    # 3. No code status / advance directive documented.
    has_code_status = any(f.category == "advance_directive" for f in current)
    if not has_code_status:
        issues.append(
            InformationIssue(
                issue_id="is.code_status_missing",
                type="missing",
                severity="attention",
                category="advance_directive",
                title="Code status not documented",
                detail=(
                    "No code status or advance directive appears in any "
                    "available document for this patient."
                ),
                sources=[],
                detected_by="rule:no_advance_directive",
            )
        )

    return issues


# ------------------------------------------------------------------ all


def detect_all_issues(
    facts: list[ExtractedFact],
    corpus: dict[str, ClinicalDocument],
    now: datetime,
) -> list[InformationIssue]:
    issues: list[InformationIssue] = []
    conflict = detect_allergy_conflict(facts)
    if conflict:
        issues.append(conflict)
    issues.extend(detect_stale_documents(corpus, now))
    issues.extend(detect_missing_information(facts, corpus))
    return issues
