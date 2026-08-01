"""Markdown document parser and corpus loader.

Documents are markdown with a frontmatter block and `## ` section headings.
Each section becomes one DocumentPassage with a stable, deterministic ID:
'{doc_id}#pNN' in section order. Chunking at authoring-time section
boundaries is what makes citation highlighting exact (BLUEPRINT §6).
"""
from __future__ import annotations

import re
from pathlib import Path

from backend.models import ClinicalDocument, DocumentPassage

FRONTMATTER_RE = re.compile(r"^---\s*$(.*?)^---\s*$", re.MULTILINE | re.DOTALL)
SECTION_RE = re.compile(r"^## +(.+?)\s*$", re.MULTILINE)


def parse_document(path: Path) -> ClinicalDocument:
    raw = path.read_text(encoding="utf-8")

    fm_match = FRONTMATTER_RE.search(raw)
    if not fm_match:
        raise ValueError(f"{path.name}: missing frontmatter block")

    meta: dict[str, str] = {}
    for line in fm_match.group(1).strip().splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()

    body = raw[fm_match.end():]
    doc_id = meta["doc_id"]

    passages: list[DocumentPassage] = []
    matches = list(SECTION_RE.finditer(body))
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        text = body[start:end].strip()
        ordinal = i + 1
        passages.append(
            DocumentPassage(
                passage_id=f"{doc_id}#p{ordinal:02d}",
                ordinal=ordinal,
                heading=m.group(1),
                text=text,
                char_start=start,
                char_end=end,
            )
        )

    return ClinicalDocument(
        doc_id=doc_id,
        patient_id=meta["patient_id"],
        title=meta["title"],
        doc_type=meta["doc_type"],  # type: ignore[arg-type]
        origin=meta["origin"],  # type: ignore[arg-type]
        author_role=meta["author_role"],
        authored_at=meta["authored_at"],  # type: ignore[arg-type]
        is_live_event=meta.get("is_live_event", "false").lower() == "true",
        passages=passages,
    )


def load_corpus(documents_dir: Path) -> dict[str, ClinicalDocument]:
    """Load every document in a patient's documents directory, keyed by doc_id."""
    corpus: dict[str, ClinicalDocument] = {}
    for path in sorted(documents_dir.glob("*.md")):
        doc = parse_document(path)
        corpus[doc.doc_id] = doc
    return corpus


def all_passage_ids(corpus: dict[str, ClinicalDocument]) -> set[str]:
    return {p.passage_id for doc in corpus.values() for p in doc.passages}


def passage_texts(corpus: dict[str, ClinicalDocument]) -> dict[str, str]:
    return {p.passage_id: p.text for doc in corpus.values() for p in doc.passages}
