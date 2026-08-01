"""Clinical document and passage models.

Documents are the immutable source layer. Passage IDs are stable and
content-addressed at seed time — citation integrity depends on this
(see docs/BLUEPRINT.md §4, §6).
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

DocType = Literal[
    "ems_report",
    "triage_note",
    "med_list",
    "discharge_summary",
    "consult_note",
    "lab_report",
    "imaging_report",
    "nursing_note",
]

DocOrigin = Literal["prehospital", "ed", "prior_encounter", "results"]


class DocumentPassage(BaseModel):
    """One citable unit of a document. passage_id = '{doc_id}#pNN'."""

    passage_id: str
    ordinal: int
    heading: str
    text: str
    char_start: int
    char_end: int


class ClinicalDocument(BaseModel):
    doc_id: str
    patient_id: str
    title: str
    doc_type: DocType
    origin: DocOrigin
    author_role: str
    authored_at: datetime
    ingested_at: Optional[datetime] = None
    is_live_event: bool = False
    synthetic: bool = True
    passages: list[DocumentPassage] = Field(default_factory=list)

    def passage(self, passage_id: str) -> Optional[DocumentPassage]:
        for p in self.passages:
            if p.passage_id == passage_id:
                return p
        return None


class RetrievedPassage(BaseModel):
    """A passage as returned by retrieval, with scoring context."""

    passage_id: str
    doc_id: str
    doc_title: str
    doc_type: DocType
    authored_at: datetime
    heading: str
    text: str
    score: float = 0.0
    retriever: Literal["bm25", "embedding", "fused", "pinned"] = "fused"
