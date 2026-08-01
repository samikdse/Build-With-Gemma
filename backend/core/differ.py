"""Deterministic state-version differ.

diff_states(prev, curr) is pure code over two immutable PatientState
snapshots. It must never miss a change — Gemma only NARRATES its output
(call G4), so a change the differ misses does not exist for the product.
"""
from __future__ import annotations

from backend.models import PatientState, StateChange, StateDiff


def _vital_key(v) -> str:
    return v.type


def diff_states(prev: PatientState, curr: PatientState) -> StateDiff:
    changes: list[StateChange] = []

    # ------------------------------------------------------------ results
    prev_results = {r.name: r for r in prev.results}
    curr_results = {r.name: r for r in curr.results}

    for name, curr_r in curr_results.items():
        prev_r = prev_results.get(name)
        if prev_r is None:
            changes.append(
                StateChange(
                    type="result_added",
                    severity="critical" if curr_r.flag == "critical" else "attention",
                    label=f"New result: {name} {curr_r.value or ''} {curr_r.unit or ''}".strip(),
                    field=name,
                    to_value=curr_r.value,
                    at=curr_r.resulted_at,
                    sources=curr_r.sources,
                    reason="not yet acknowledged" if not curr_r.acknowledged else None,
                )
            )
        elif prev_r.status != curr_r.status or prev_r.value != curr_r.value:
            severity = "critical" if curr_r.flag == "critical" else "attention"
            label = (
                f"{name}: {prev_r.status} → "
                f"{curr_r.value or curr_r.status} {curr_r.unit or ''}".strip()
            )
            if curr_r.flag == "critical":
                label += " (critical)"
            changes.append(
                StateChange(
                    type="result_updated",
                    severity=severity,
                    label=label,
                    field=name,
                    from_value=prev_r.value or prev_r.status,
                    to_value=curr_r.value or curr_r.status,
                    at=curr_r.resulted_at,
                    sources=curr_r.sources,
                    reason="not yet acknowledged" if not curr_r.acknowledged else None,
                )
            )

    # ------------------------------------------------------------- vitals
    prev_vitals = {_vital_key(v): v for v in prev.vitals}
    curr_vitals = {_vital_key(v): v for v in curr.vitals}

    for vtype, curr_v in curr_vitals.items():
        prev_v = prev_vitals.get(vtype)
        if prev_v is None:
            continue  # baseline vitals are not "changes"
        if prev_v.value != curr_v.value:
            changes.append(
                StateChange(
                    type="vital_changed",
                    severity="attention",
                    label=f"{vtype.replace('_', ' ')}: {prev_v.value} → {curr_v.value}",
                    field=vtype,
                    from_value=prev_v.value,
                    to_value=curr_v.value,
                    at=curr_v.recorded_at,
                    sources=curr_v.sources,
                )
            )
        # A qualitative detail that is newly documented is a finding.
        if curr_v.detail and curr_v.detail != prev_v.detail:
            changes.append(
                StateChange(
                    type="finding_added",
                    severity="attention",
                    label=f"Newly documented: {vtype.replace('_', ' ')} {curr_v.detail}",
                    field=vtype,
                    to_value=curr_v.detail,
                    at=curr_v.recorded_at,
                    sources=curr_v.sources,
                )
            )

    # -------------------------------------------------------------- tasks
    prev_tasks = {t.task_id: t for t in prev.tasks}
    curr_tasks = {t.task_id: t for t in curr.tasks}

    for task_id, curr_t in curr_tasks.items():
        prev_t = prev_tasks.get(task_id)
        if prev_t is None:
            changes.append(
                StateChange(
                    type="task_opened",
                    severity="info",
                    label=f"Task opened: {task_id}",
                    task_id=task_id,
                )
            )
            continue
        if prev_t.status != "complete" and curr_t.status == "complete":
            changes.append(
                StateChange(
                    type="task_completed",
                    severity="info",
                    label=f"Task completed: {task_id}",
                    task_id=task_id,
                )
            )
        if not prev_t.overdue and curr_t.overdue:
            changes.append(
                StateChange(
                    type="task_overdue",
                    severity="attention",
                    label=f"Task now overdue: {task_id}",
                    task_id=task_id,
                )
            )

    # ------------------------------------------------------------- issues
    prev_issues = set(prev.issues)
    curr_issues = set(curr.issues)
    for issue_id in sorted(curr_issues - prev_issues):
        changes.append(
            StateChange(
                type="issue_added",
                severity="attention",
                label=f"New information issue: {issue_id}",
                issue_id=issue_id,
            )
        )
    for issue_id in sorted(prev_issues - curr_issues):
        changes.append(
            StateChange(
                type="issue_resolved",
                severity="info",
                label=f"Information issue resolved: {issue_id}",
                issue_id=issue_id,
            )
        )

    # ----------------------------------------------------- newly relevant
    # Rule: a new critical result makes standing anticoagulation facts newly
    # relevant. Information-state framing only — the rule states WHY the
    # existing fact now intersects new information; it draws no conclusion.
    has_new_critical = any(
        c.severity == "critical" and c.type in ("result_added", "result_updated")
        for c in changes
    )
    if has_new_critical:
        for med in curr.medications:
            if med.drug_class == "anticoagulant":
                changes.append(
                    StateChange(
                        type="newly_relevant",
                        severity="attention",
                        label=f"Newly relevant: active {med.name} therapy",
                        fact_id=med.fact_id,
                        sources=med.sources,
                        reason=(
                            "a new critical result intersects the patient's "
                            "documented anticoagulation status"
                        ),
                    )
                )

    return StateDiff(
        diff_id=f"diff.v{prev.version}_v{curr.version}",
        patient_id=curr.patient_id,
        from_version=prev.version,
        to_version=curr.version,
        changes=changes,
    )
