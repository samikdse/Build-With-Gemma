"""ExtractedFact — the atom of patient state.

Facts are never edited, only superseded. An explicit denial (e.g. "no known
drug allergies") is a fact with negated=True — a positive assertion of
absence, never a missing field. This is what makes conflict detection a
code-level comparison instead of a prose-reading exercise.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

FactCategory = Literal[
    "problem",
    "medication",
    "medication_administered",
    "allergy",
    "vital",
    "result",
    "procedure",
    "social",
    "advance_directive",
    "task",
    "narrative",
]

FactEra = Literal["current_encounter", "historical"]


class FactSource(BaseModel):
    """A resolved citation: passage plus the document context a UI needs."""

    passage_id: str
    doc_id: str
    doc_title: str
    authored_at: datetime


class ExtractedFact(BaseModel):
    fact_id: str
    category: FactCategory
    key: str
    value: dict[str, Any] = Field(default_factory=dict)
    # When the SOURCE asserted it (document time), not when we extracted it.
    asserted_at: datetime
    extracted_at: datetime
    confidence: float = 1.0
    extraction_status: Literal["fixture", "extracted", "reviewed"] = "fixture"
    provenance: list[str] = Field(default_factory=list)  # passage_ids
    # True encodes an explicit denial, e.g. NKDA. Never omit denials.
    negated: bool = False
    era: FactEra = "current_encounter"
    superseded_by: Optional[str] = None

    @property
    def is_current(self) -> bool:
        return self.superseded_by is None
