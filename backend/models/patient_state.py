"""Patient, encounter, and the versioned PatientState.

PatientState is immutable and append-only: v1 is never mutated when v2 is
created. This is what makes the diff trustworthy and the demo reproducible.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- entities


class Patient(BaseModel):
    patient_id: str
    name: str
    age: int
    sex: Literal["F", "M", "X"]
    date_of_birth: date
    mrn: str
    synthetic: bool = True


class Encounter(BaseModel):
    encounter_id: str
    patient_id: str
    bed: str
    chief_complaint: str
    arrived_at: datetime
    status: str  # e.g. "awaiting_cardiology"


# ------------------------------------------------------- state components


class ProblemEntry(BaseModel):
    fact_id: str
    label: str
    active: bool = True
    sources: list[str] = Field(default_factory=list)


class MedicationEntry(BaseModel):
    fact_id: str
    name: str
    dose: str
    route: str
    frequency: str
    drug_class: Optional[str] = None
    last_reconciled: Optional[date] = None
    stale: bool = False
    sources: list[str] = Field(default_factory=list)


class AllergyBlock(BaseModel):
    # "conflicting" means the record disagrees with itself. The system
    # surfaces this; it NEVER picks a side.
    status: Literal["none_documented", "documented", "conflicting"]
    entries: list[str] = Field(default_factory=list)  # fact_ids, incl. negated


class VitalEntry(BaseModel):
    type: str  # pain_score | heart_rate | blood_pressure | resp_rate | spo2 | temp
    value: Union[int, float, str]
    unit: Optional[str] = None
    detail: Optional[str] = None  # e.g. "radiating to left arm", "irregular"
    recorded_at: datetime
    sources: list[str] = Field(default_factory=list)


class ResultEntry(BaseModel):
    name: str
    status: Literal["pending", "resulted"]
    value: Optional[str] = None
    unit: Optional[str] = None
    flag: Optional[Literal["normal", "abnormal", "critical"]] = None
    collected_at: Optional[datetime] = None
    resulted_at: Optional[datetime] = None
    acknowledged: bool = True
    sources: list[str] = Field(default_factory=list)


class TaskSnapshot(BaseModel):
    """Per-version task status. Task identity lives in OutstandingTask;
    status varies by state version, so it is snapshotted here."""

    task_id: str
    status: Literal["pending", "in_progress", "complete", "cancelled"]
    overdue: bool = False


# ------------------------------------------------------ standalone records


class OutstandingTask(BaseModel):
    task_id: str
    label: str
    status: Literal["pending", "in_progress", "complete", "cancelled"]
    opened_at: datetime
    due_by: Optional[datetime] = None
    source: Optional[str] = None  # passage_id
    created_by: Literal["extraction", "clinician", "rule", "fixture"] = "fixture"


IssueType = Literal["conflict", "missing", "outdated"]


class InformationIssue(BaseModel):
    """Information-state problems only — never clinical judgements."""

    issue_id: str
    type: IssueType
    severity: Literal["attention", "critical"] = "attention"
    category: str
    title: str
    detail: str
    sources: list[str] = Field(default_factory=list)
    detected_by: str = "rule"
    resolution: Optional[str] = None  # the system NEVER auto-resolves
    resolved_by: Optional[str] = None


class TimelineEvent(BaseModel):
    event_id: str
    at: datetime
    kind: Literal[
        "arrival",
        "assessment",
        "result",
        "order",
        "medication",
        "consult",
        "note",
        "status_change",
    ]
    label: str
    sources: list[str] = Field(default_factory=list)
    state_version: int = 1


# ------------------------------------------------------------ the state


class PatientState(BaseModel):
    state_id: str
    patient_id: str
    version: int
    created_at: datetime
    trigger: dict[str, Any] = Field(default_factory=dict)
    parent_version: Optional[int] = None

    demographics: dict[str, Any] = Field(default_factory=dict)
    encounter: dict[str, Any] = Field(default_factory=dict)

    problems: list[ProblemEntry] = Field(default_factory=list)
    medications: list[MedicationEntry] = Field(default_factory=list)
    allergies: AllergyBlock
    vitals: list[VitalEntry] = Field(default_factory=list)
    results: list[ResultEntry] = Field(default_factory=list)
    tasks: list[TaskSnapshot] = Field(default_factory=list)
    timeline: list[str] = Field(default_factory=list)  # TimelineEvent ids
    issues: list[str] = Field(default_factory=list)  # InformationIssue ids
    facts: list[str] = Field(default_factory=list)  # all fact_ids in this version


class PatientStateVersion(BaseModel):
    """Lightweight metadata row for the version history endpoint/UI."""

    version: int
    state_id: str
    created_at: datetime
    trigger: dict[str, Any] = Field(default_factory=dict)
    parent_version: Optional[int] = None

    @classmethod
    def from_state(cls, state: PatientState) -> "PatientStateVersion":
        return cls(
            version=state.version,
            state_id=state.state_id,
            created_at=state.created_at,
            trigger=state.trigger,
            parent_version=state.parent_version,
        )
