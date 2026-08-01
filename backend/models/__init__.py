"""Canonical data contracts for Clinical Flow (docs/BLUEPRINT.md §4).

Naming map against the blueprint:
  Fact      -> ExtractedFact
  Issue     -> InformationIssue
  ChangeSet -> StateDiff
  AIOutput  -> AskChartAnswer / GeneratedDraft
"""
from backend.models.document import (
    ClinicalDocument,
    DocumentPassage,
    RetrievedPassage,
)
from backend.models.fact import ExtractedFact, FactSource
from backend.models.patient_state import (
    AllergyBlock,
    Encounter,
    InformationIssue,
    MedicationEntry,
    OutstandingTask,
    Patient,
    PatientState,
    PatientStateVersion,
    ProblemEntry,
    ResultEntry,
    TaskSnapshot,
    TimelineEvent,
    VitalEntry,
)
from backend.models.diff import StateChange, StateDiff
from backend.models.outputs import (
    AskChartAnswer,
    CitationValidation,
    GeneratedDraft,
    SourcedText,
)

__all__ = [
    "AllergyBlock",
    "AskChartAnswer",
    "CitationValidation",
    "ClinicalDocument",
    "DocumentPassage",
    "Encounter",
    "ExtractedFact",
    "FactSource",
    "GeneratedDraft",
    "InformationIssue",
    "MedicationEntry",
    "OutstandingTask",
    "Patient",
    "PatientState",
    "PatientStateVersion",
    "ProblemEntry",
    "ResultEntry",
    "RetrievedPassage",
    "SourcedText",
    "StateChange",
    "StateDiff",
    "TaskSnapshot",
    "TimelineEvent",
    "VitalEntry",
]
