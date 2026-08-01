"""Issue-detection rules: the conflicts and flags the demo depends on.

If any of these fail silently, the demo's central beats do not fire.
"""
from datetime import datetime, timezone

from backend.core.fixtures import load_facts, load_patient_corpus
from backend.core.issues import (
    detect_all_issues,
    detect_allergy_conflict,
    detect_missing_information,
    detect_stale_documents,
)

NOW = datetime(2026, 8, 1, 14, 30, tzinfo=timezone.utc)


def test_allergy_conflict_detected():
    facts = load_facts()
    issue = detect_allergy_conflict(facts)
    assert issue is not None, "the planted allergy conflict MUST fire"
    assert issue.type == "conflict"
    assert issue.issue_id == "is.allergy_conflict"
    # Both sides must be linked — the system shows both, decides nothing.
    assert "doc.discharge_2023_03#p05" in issue.sources
    assert "doc.triage_note#p02" in issue.sources
    assert issue.resolution is None
    assert issue.resolved_by is None


def test_nkda_is_explicit_negative_assertion():
    """'No known drug allergies' must exist as a negated fact — a positive
    assertion of absence — never as a missing allergy field."""
    facts = load_facts()
    nkda = [f for f in facts if f.category == "allergy" and f.negated]
    assert len(nkda) == 1
    assert nkda[0].fact_id == "f.allergy_nkda"
    assert nkda[0].provenance == ["doc.triage_note#p02"]
    # And the positive assertion coexists as its own fact.
    positives = [f for f in facts if f.category == "allergy" and not f.negated]
    assert [f.fact_id for f in positives] == ["f.allergy_penicillin"]


def test_no_conflict_without_the_denial():
    """Removing the NKDA fact removes the conflict — proving the detector
    compares structured facts, not prose."""
    facts = [f for f in load_facts() if f.fact_id != "f.allergy_nkda"]
    assert detect_allergy_conflict(facts) is None


def test_stale_medication_list_flagged():
    corpus = load_patient_corpus()
    issues = detect_stale_documents(corpus, NOW)
    assert len(issues) == 1
    issue = issues[0]
    assert issue.issue_id == "is.med_list_stale"
    assert issue.type == "outdated"
    assert "2025-06-02" in issue.detail
    assert "14 months" in issue.detail
    # Framed as MAY be outdated — never as incorrect.
    assert "may not reflect" in issue.detail.lower()


def test_todays_documents_are_not_flagged_stale():
    corpus = load_patient_corpus()
    issues = detect_stale_documents(
        corpus, NOW, doc_types=("triage_note", "nursing_note", "lab_report")
    )
    assert issues == []


def test_missing_information_rules():
    facts = load_facts()
    corpus = load_patient_corpus()
    missing = detect_missing_information(facts, corpus)
    ids = {i.issue_id for i in missing}
    assert ids == {"is.inr_missing", "is.echo_missing", "is.code_status_missing"}
    for issue in missing:
        assert issue.type == "missing"
        assert issue.resolution is None


def test_inr_missing_stops_firing_if_inr_result_exists():
    facts = load_facts()
    # Simulate an INR result arriving.
    inr = facts[0].model_copy(
        update={
            "fact_id": "f.result_inr",
            "category": "result",
            "key": "inr",
            "value": {"value": "2.4"},
            "negated": False,
            "superseded_by": None,
        }
    )
    missing = detect_missing_information(facts + [inr], load_patient_corpus())
    assert "is.inr_missing" not in {i.issue_id for i in missing}


def test_detect_all_issues_matches_fixture_ids():
    facts = load_facts()
    corpus = load_patient_corpus()
    detected = {i.issue_id for i in detect_all_issues(facts, corpus, NOW)}
    assert detected == {
        "is.allergy_conflict",
        "is.med_list_stale",
        "is.inr_missing",
        "is.echo_missing",
        "is.code_status_missing",
    }
