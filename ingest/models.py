"""
models.py -- Pydantic models for the KATHA ingestion pipeline.

Defines: RawRecord, WisdomSignal, LivingMemoryObject, IngestResult.
All data crossing component boundaries uses these models.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Valid enumerations
# ---------------------------------------------------------------------------

VALID_LIFE_THEMES: set[str] = {
    "failure-recovery",
    "love-as-action",
    "persistence",
    "identity",
    "letting-go",
    "unconditional-support",
    "wonder",
    "endurance",
}

VALID_SITUATIONAL_TRIGGERS: set[str] = {
    "descendant-struggling-silently",
    "descendant-considering-quitting",
    "descendant-first-failure",
    "descendant-leaving-home",
    "descendant-becoming-parent",
    "descendant-losing-someone",
    "descendant-facing-injustice",
    "descendant-celebrating-milestone",
    "descendant-feeling-alone",
    "descendant-questioning-identity",
    "descendant-making-sacrifice",
    "descendant-seeking-purpose",
}

VALID_MEMORY_TYPES: set[str] = {"recorded", "reconstructed"}


# ---------------------------------------------------------------------------
# Input model -- one JSONL record
# ---------------------------------------------------------------------------

class RawRecord(BaseModel):
    """A single record loaded from a persona JSONL file."""

    id: str
    ts: str
    source: str
    type: str
    text: str
    tags: list[str] = Field(default_factory=list)
    refs: list[str] = Field(default_factory=list)
    pii_level: str = "synthetic"


# ---------------------------------------------------------------------------
# Intermediate model -- Claude extraction output
# ---------------------------------------------------------------------------

class WisdomSignal(BaseModel):
    """Raw wisdom signal returned by Claude for one record."""

    source_record_id: str
    original_text: str
    wisdom_signal: str
    value_expressed: str
    situational_tag_candidates: list[str] = Field(default_factory=list)
    emotional_weight: int = Field(ge=1, le=10)
    life_theme: str


# ---------------------------------------------------------------------------
# Output model -- fully formed LMO
# ---------------------------------------------------------------------------

class LivingMemoryObject(BaseModel):
    """A validated Living Memory Object ready for the passport."""

    memory_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_ref: str
    contributor_name: str
    emotional_weight: int = Field(ge=1, le=10)
    life_theme: str
    situational_tags: list[str]
    memory_type: str = "recorded"
    verified_by_subject: bool = True
    text: str
    wisdom_extracted: str
    value_expressed: str
    created_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z"
    )


# ---------------------------------------------------------------------------
# Pipeline result summary
# ---------------------------------------------------------------------------

class IngestResult(BaseModel):
    """Summary of a complete ingestion run."""

    persona_id: str
    contributor_name: str
    total_records_loaded: int
    unique_records: int
    wisdom_signals_extracted: int
    lmos_after_gate: int
    passport_id: Optional[str] = None
    memories_posted: int = 0
    elapsed_seconds: float = 0.0
