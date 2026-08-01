"""Citation parsing and validation.

Every generated artifact passes through here before it reaches the UI.
Fabricated or out-of-context passage IDs are stripped, and the
{claimed, valid, stripped} counts are recorded on the output (BLUEPRINT §6).
The model is never trusted to grade itself.
"""
from __future__ import annotations

import re
from typing import Iterable, Optional

from backend.models import CitationValidation

# Matches [doc.some_id#p04] inline citation markers.
CITATION_RE = re.compile(r"\[(doc\.[a-z0-9_]+#p\d{2})\]")


def extract_inline_citations(text: str) -> list[str]:
    return CITATION_RE.findall(text)


def validate_citations(
    claimed: Iterable[str],
    corpus_passage_ids: set[str],
    allowed: Optional[set[str]] = None,
) -> CitationValidation:
    """Validate claimed passage IDs against the corpus.

    `allowed` restricts further to the retrieved set for this call (used by
    Ask the Chart so the model cannot cite passages it was never shown).
    """
    claimed_list = list(claimed)
    valid: list[str] = []
    stripped: list[str] = []
    for pid in claimed_list:
        if pid not in corpus_passage_ids:
            stripped.append(pid)
        elif allowed is not None and pid not in allowed:
            stripped.append(pid)
        else:
            valid.append(pid)
    return CitationValidation(
        claimed=len(claimed_list),
        valid=len(valid),
        stripped=len(stripped),
        stripped_ids=stripped,
    )


def strip_invalid_citations(
    text: str,
    corpus_passage_ids: set[str],
    allowed: Optional[set[str]] = None,
) -> tuple[str, CitationValidation]:
    """Remove invalid inline citation markers from text; return cleaned text
    plus the validation record."""
    claimed = extract_inline_citations(text)
    report = validate_citations(claimed, corpus_passage_ids, allowed)
    cleaned = text
    for pid in report.stripped_ids:
        cleaned = cleaned.replace(f"[{pid}]", "")
    # normalize doubled spaces left behind by stripping
    cleaned = re.sub(r"  +", " ", cleaned).strip()
    return cleaned, report
