"""Citation integrity: fabricated references must never reach the screen,
and every fixture claim must be supported by a real passage.
"""
import json

from backend.core.citations import (
    extract_inline_citations,
    strip_invalid_citations,
    validate_citations,
)
from backend.core.documents import all_passage_ids, passage_texts
from backend.core.fixtures import list_cache_files, load_cache, load_patient_corpus

CORPUS = load_patient_corpus()
PASSAGE_IDS = all_passage_ids(CORPUS)


def _collect_citations(node) -> list[str]:
    """Recursively collect every citation/sources entry in a cache JSON."""
    found: list[str] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key in ("sources", "citations") and isinstance(value, list):
                found.extend(v for v in value if isinstance(v, str))
            else:
                found.extend(_collect_citations(value))
    elif isinstance(node, list):
        for item in node:
            found.extend(_collect_citations(item))
    return found


def test_corpus_loaded_completely():
    assert len(CORPUS) == 10
    # 5+5+2+6+3+3+2+3+3+2 sections across the ten documents
    assert len(PASSAGE_IDS) == 34


def test_every_cached_citation_exists_in_corpus():
    for path in list_cache_files():
        data = json.loads(path.read_text(encoding="utf-8"))
        cited = _collect_citations(data)
        for pid in cited:
            assert pid in PASSAGE_IDS, f"{path.name} cites nonexistent passage {pid}"


def test_fabricated_citation_is_stripped():
    fake = "doc.fake_document#p99"
    report = validate_citations(
        ["doc.triage_note#p02", fake], PASSAGE_IDS
    )
    assert report.claimed == 2
    assert report.valid == 1
    assert report.stripped == 1
    assert report.stripped_ids == [fake]


def test_out_of_context_citation_is_stripped():
    """A real passage that was NOT in the retrieved set still gets stripped —
    the model cannot cite passages it was never shown."""
    allowed = {"doc.discharge_2023_03#p02"}
    report = validate_citations(
        ["doc.discharge_2023_03#p02", "doc.triage_note#p02"],
        PASSAGE_IDS,
        allowed=allowed,
    )
    assert report.valid == 1
    assert report.stripped_ids == ["doc.triage_note#p02"]


def test_inline_citation_stripping_cleans_text():
    text = (
        "Warfarin was started in March 2023. [doc.discharge_2023_03#p02] "
        "It cures everything. [doc.invented#p01]"
    )
    cleaned, report = strip_invalid_citations(text, PASSAGE_IDS)
    assert "[doc.discharge_2023_03#p02]" in cleaned
    assert "doc.invented" not in cleaned
    assert report.stripped == 1


def test_inline_citation_regex():
    text = "A claim. [doc.triage_note#p02] Another. [doc.lab_troponin_2#p01]"
    assert extract_inline_citations(text) == [
        "doc.triage_note#p02",
        "doc.lab_troponin_2#p01",
    ]


# ---------------------------------------------------------- NOT_FOUND


def test_planted_not_found_fact_is_truly_absent():
    """The echo question must be unanswerable: no passage anywhere may
    mention an echocardiogram or ejection fraction."""
    for pid, text in passage_texts(CORPUS).items():
        lowered = text.lower()
        assert "echocardiogram" not in lowered, pid
        assert "ejection fraction" not in lowered, pid


def test_not_found_answer_has_no_citations():
    answer = load_cache("ask_last_echo")
    assert answer["status"] == "not_found"
    assert answer["citations"] == []
    assert answer["answer"][0]["text"].startswith("NOT_FOUND:")
    assert answer["searched"]["used"] == 0


def test_inr_value_is_truly_absent():
    """INR monitoring is mentioned (that's realistic) but no INR VALUE may
    exist anywhere — it is a planted missing item."""
    import re

    for pid, text in passage_texts(CORPUS).items():
        # A measured value like "INR 2.4" or "INR: 2.4" must not appear.
        # A therapeutic target range ("target INR 2.0 to 3.0") is allowed —
        # it is a goal from 2023 documentation, not a current measurement.
        assert not re.search(r"(?<!target )INR\s*[:=]?\s*\d", text), pid
