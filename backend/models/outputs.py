"""AI-facing output contracts: Ask the Chart answers and generated drafts.

Nothing generated is ever silently promoted to approved — `status` is the
safety spine of the product. (Blueprint: 'AIOutput' — split here into
AskChartAnswer and GeneratedDraft per the Phase 1 data-contract naming.)
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class CitationValidation(BaseModel):
    claimed: int
    valid: int
    stripped: int = 0
    stripped_ids: list[str] = Field(default_factory=list)


class SourcedText(BaseModel):
    """One statement plus the passages that directly support it."""

    text: str
    sources: list[str] = Field(default_factory=list)


class AskChartAnswer(BaseModel):
    question: str
    status: Literal["answered", "not_found"]
    # For not_found: one line naming what would be needed to answer.
    answer: list[SourcedText] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    searched: Optional[dict[str, int]] = None  # {"passages": N, "documents": N, "used": N}
    citation_validation: Optional[CitationValidation] = None
    model: str = "fixture"
    from_cache: bool = True
    generated_at: Optional[datetime] = None


DraftKind = Literal["brief", "change_narrative", "progress_note", "sbar", "issue_explanation"]


class GeneratedDraft(BaseModel):
    output_id: str
    kind: DraftKind
    patient_id: str
    state_version: int
    content: dict[str, Any] = Field(default_factory=dict)
    citations: list[str] = Field(default_factory=list)
    citation_validation: Optional[CitationValidation] = None
    model: str = "fixture"
    generated_at: Optional[datetime] = None
    latency_ms: Optional[int] = None
    from_cache: bool = True
    status: Literal["draft", "approved", "rejected"] = "draft"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
