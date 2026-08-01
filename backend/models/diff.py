"""StateDiff — the output of the deterministic differ.

Gemma narrates this structure (call G4); it never re-reads raw documents to
find changes, so it cannot invent one. (Blueprint: 'ChangeSet' — renamed
StateDiff per the Phase 1 data-contract naming.)
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union

from pydantic import BaseModel, Field

ChangeType = Literal[
    "result_added",
    "result_updated",       # includes pending -> resulted
    "vital_changed",
    "finding_added",        # newly documented qualitative finding
    "task_opened",
    "task_completed",
    "task_overdue",
    "issue_added",
    "issue_resolved",
    "newly_relevant",       # existing fact intersects a new critical change
]

ChangeSeverity = Literal["info", "attention", "critical"]


class StateChange(BaseModel):
    type: ChangeType
    severity: ChangeSeverity = "info"
    label: str
    field: Optional[str] = None
    from_value: Optional[Union[int, float, str]] = None
    to_value: Optional[Union[int, float, str]] = None
    task_id: Optional[str] = None
    fact_id: Optional[str] = None
    issue_id: Optional[str] = None
    at: Optional[datetime] = None
    sources: list[str] = Field(default_factory=list)
    reason: Optional[str] = None


class StateDiff(BaseModel):
    diff_id: str
    patient_id: str
    from_version: int
    to_version: int
    computed_at: Optional[datetime] = None
    changes: list[StateChange] = Field(default_factory=list)
    # Filled by Gemma from `changes` — never from raw documents.
    narrative: Optional[str] = None

    def of_type(self, change_type: str) -> list[StateChange]:
        return [c for c in self.changes if c.type == change_type]
