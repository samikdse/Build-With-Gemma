"""Fixture integrity: every reference resolves, versions chain correctly,
and no expected output contains diagnostic or treatment language.
"""
import json

from backend.core.fixtures import (
    list_cache_files,
    load_cache,
    load_facts,
    load_issues,
    load_state,
    load_tasks,
    load_timeline,
)

FACT_IDS = {f.fact_id for f in load_facts()}
TASK_IDS = {t.task_id for t in load_tasks()}
ISSUE_IDS = {i.issue_id for i in load_issues()}
TIMELINE_IDS = {e.event_id for e in load_timeline()}


def test_states_validate_and_chain():
    v1, v2, v3 = load_state(1), load_state(2), load_state(3)
    assert (v1.version, v2.version, v3.version) == (1, 2, 3)
    assert v1.parent_version is None
    assert v2.parent_version == 1
    assert v3.parent_version == 2
    assert v1.created_at < v2.created_at < v3.created_at
    assert v2.trigger["event_id"] == "ev.nursing_reassess"
    assert v3.trigger["event_id"] == "ev.troponin_result"


def test_state_references_all_resolve():
    for version in (1, 2, 3):
        state = load_state(version)
        for fact_id in state.facts:
            assert fact_id in FACT_IDS, f"v{version}: unknown fact {fact_id}"
        for snapshot in state.tasks:
            assert snapshot.task_id in TASK_IDS
        for issue_id in state.issues:
            assert issue_id in ISSUE_IDS
        for event_id in state.timeline:
            assert event_id in TIMELINE_IDS
        for entry in state.allergies.entries:
            assert entry in FACT_IDS


def test_versions_are_append_only():
    """Facts and timeline entries only accumulate — nothing disappears."""
    v1, v2, v3 = load_state(1), load_state(2), load_state(3)
    assert set(v1.facts) < set(v2.facts) < set(v3.facts)
    assert set(v1.timeline) < set(v2.timeline) < set(v3.timeline)


def test_supersession_chain():
    facts = {f.fact_id: f for f in load_facts()}
    assert facts["f.vital_pain_initial"].superseded_by == "f.vital_pain_reassess"
    assert facts["f.result_troponin_pending"].superseded_by == "f.result_troponin_1"
    assert facts["f.result_troponin_1"].superseded_by is None


def test_troponin_unacknowledged_in_v3():
    v3 = load_state(3)
    trop = [r for r in v3.results if r.name == "Troponin I"][0]
    assert trop.status == "resulted"
    assert trop.flag == "critical"
    assert trop.acknowledged is False


# ------------------------------------------------- safety language gate

# Terms that would mean the system diagnosed, treated, or ranked acuity.
BANNED_TERMS = (
    "myocardial infarction",
    "acute coronary",
    " acs ",
    "ischemia",
    "ischemic",
    "heart attack",
    "diagnos",          # diagnosis / diagnosed / diagnostic-of
    "consistent with",
    "suggestive of",
    "suggests",
    "likely",
    "probable",
    "rule out",
    "recommend starting",
    "should be treated",
    "high risk",
    "unstable",
)


def _all_text(node) -> str:
    if isinstance(node, dict):
        return " ".join(_all_text(v) for v in node.values())
    if isinstance(node, list):
        return " ".join(_all_text(v) for v in node)
    if isinstance(node, str):
        return node
    return ""


def test_no_cached_output_contains_diagnostic_language():
    for path in list_cache_files():
        text = " " + _all_text(json.loads(path.read_text(encoding="utf-8"))).lower() + " "
        for term in BANNED_TERMS:
            assert term not in text, f"{path.name} contains banned term '{term}'"


def test_sbar_cites_only_real_supported_passages():
    """Every SBAR statement carries at least one source, and the final SBAR
    contains no unsourced free-floating claims."""
    sbar = load_cache("sbar_v3")
    for section in ("situation", "background", "current_state", "outstanding"):
        for statement in sbar["content"][section]:
            assert statement["sources"], (
                f"unsourced SBAR statement: {statement['text']!r}"
            )


def test_conflict_is_surfaced_not_resolved():
    """No fixture anywhere may pick a side of the allergy conflict."""
    for issue in load_issues():
        assert issue.resolution is None
        assert issue.resolved_by is None
    # The SBAR carries the conflict forward as unresolved.
    sbar_text = _all_text(load_cache("sbar_v3")).lower()
    assert "conflict" in sbar_text or "disagree" in sbar_text
