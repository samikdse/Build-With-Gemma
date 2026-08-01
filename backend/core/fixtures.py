"""Loaders for the synthetic-data fixtures and cached expected outputs."""
from __future__ import annotations

import json
from pathlib import Path

from backend.models import (
    ClinicalDocument,
    ExtractedFact,
    InformationIssue,
    OutstandingTask,
    PatientState,
    TimelineEvent,
)
from backend.core.documents import load_corpus

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
PATIENT_DIR = DATA_DIR / "patients" / "chen_margaret"
FIXTURES_DIR = PATIENT_DIR / "fixtures"
CACHE_DIR = DATA_DIR / "cache" / "chen_margaret"


def _load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_patient_corpus() -> dict[str, ClinicalDocument]:
    return load_corpus(PATIENT_DIR / "documents")


def load_facts() -> list[ExtractedFact]:
    return [ExtractedFact(**f) for f in _load_json(FIXTURES_DIR / "facts.json")]


def load_tasks() -> list[OutstandingTask]:
    return [OutstandingTask(**t) for t in _load_json(FIXTURES_DIR / "tasks.json")]


def load_issues() -> list[InformationIssue]:
    return [InformationIssue(**i) for i in _load_json(FIXTURES_DIR / "issues.json")]


def load_timeline() -> list[TimelineEvent]:
    return [TimelineEvent(**e) for e in _load_json(FIXTURES_DIR / "timeline.json")]


def load_state(version: int) -> PatientState:
    return PatientState(**_load_json(FIXTURES_DIR / f"state_v{version}.json"))


def load_cache(name: str) -> dict:
    return _load_json(CACHE_DIR / f"{name}.json")


def list_cache_files() -> list[Path]:
    return sorted(CACHE_DIR.glob("*.json"))
