"""State-version differ: the differ must never miss a change, and must not
invent one. Gemma only narrates this output.
"""
from backend.core.differ import diff_states
from backend.core.fixtures import load_state


def test_diff_same_version_is_empty():
    v1 = load_state(1)
    diff = diff_states(v1, v1)
    assert diff.changes == []


def test_diff_v1_v2_nursing_reassessment():
    diff = diff_states(load_state(1), load_state(2))

    # Pain increase is captured.
    pain = [c for c in diff.of_type("vital_changed") if c.field == "pain_score"]
    assert len(pain) == 1
    assert pain[0].from_value == 6
    assert pain[0].to_value == 8
    assert "doc.nursing_reassess#p01" in pain[0].sources

    # Radiation to left arm is a newly documented finding.
    findings = diff.of_type("finding_added")
    assert any("left arm" in c.label for c in findings)

    # Other vital shifts are captured too.
    changed_fields = {c.field for c in diff.of_type("vital_changed")}
    assert {"pain_score", "heart_rate", "blood_pressure", "resp_rate", "spo2"} == changed_fields

    # No result changes, no task changes, no newly-relevant in v1->v2.
    assert diff.of_type("result_added") == []
    assert diff.of_type("result_updated") == []
    assert diff.of_type("task_completed") == []
    assert diff.of_type("task_overdue") == []
    assert diff.of_type("newly_relevant") == []


def test_diff_v2_v3_troponin_result():
    diff = diff_states(load_state(2), load_state(3))

    # The pending troponin resolving to a critical value is ONE result update.
    updates = diff.of_type("result_updated")
    assert len(updates) == 1
    trop = updates[0]
    assert trop.field == "Troponin I"
    assert trop.from_value == "pending"
    assert trop.to_value == "0.42"
    assert trop.severity == "critical"
    assert trop.reason == "not yet acknowledged"
    assert trop.sources == ["doc.lab_troponin_2#p01"]

    # The pending item is resolved: initial troponin task completes.
    completed = diff.of_type("task_completed")
    assert [c.task_id for c in completed] == ["tk.troponin_initial"]

    # Cardiology consult crosses into overdue.
    overdue = diff.of_type("task_overdue")
    assert [c.task_id for c in overdue] == ["tk.cardiology_consult"]

    # Standing anticoagulation becomes newly relevant — driven by the
    # critical result intersecting the medication's drug_class, not prose.
    relevant = diff.of_type("newly_relevant")
    assert len(relevant) == 1
    assert relevant[0].fact_id == "f.med_warfarin"
    assert "anticoagulation" in (relevant[0].reason or "")

    # No vital changes between v2 and v3.
    assert diff.of_type("vital_changed") == []
    assert diff.of_type("finding_added") == []


def test_diff_output_is_information_state_only():
    """No diff label may contain diagnostic or treatment language."""
    banned = ("myocardial", "acute coronary", "ischemi", "diagnos",
              "recommend", "should be treated", "likely")
    for pair in ((1, 2), (2, 3)):
        diff = diff_states(load_state(pair[0]), load_state(pair[1]))
        for change in diff.changes:
            text = (change.label + " " + (change.reason or "")).lower()
            for word in banned:
                assert word not in text, f"banned term '{word}' in: {change.label}"
