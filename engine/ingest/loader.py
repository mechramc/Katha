"""
loader.py -- Load and deduplicate JSONL records across all persona files.

Responsibility:
- Read JSONL files from a persona directory via the adapter
- Deduplicate records by text content hash
- Return unique RawRecords ready for extraction
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from ingest.adapters.persona_jsonl import load_all_records, load_persona_profile
from ingest.models import RawRecord

logger = logging.getLogger(__name__)


def _text_hash(text: str) -> str:
    """Compute a SHA-256 hash of the text for deduplication."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def load_and_deduplicate(persona_dir: str | Path) -> tuple[list[RawRecord], dict]:
    """
    Load all records from a persona directory and deduplicate by text hash.

    Returns:
        (unique_records, persona_profile) -- the deduplicated list and profile dict.

    The first occurrence of each unique text is kept; later duplicates are dropped.
    This makes the pipeline idempotent: running twice on the same data produces
    the same set of unique records.
    """
    persona_path = Path(persona_dir)
    profile = load_persona_profile(persona_path)
    all_records = load_all_records(persona_path)

    seen_hashes: set[str] = set()
    unique: list[RawRecord] = []

    for record in all_records:
        h = _text_hash(record.text)
        if h not in seen_hashes:
            seen_hashes.add(h)
            unique.append(record)

    duplicates_removed = len(all_records) - len(unique)
    logger.info(
        "Deduplication: %d total -> %d unique (%d duplicates removed)",
        len(all_records),
        len(unique),
        duplicates_removed,
    )

    return unique, profile


def load(persona_dir: str | Path) -> tuple[list[RawRecord], dict]:
    """Public entry point -- alias for load_and_deduplicate."""
    return load_and_deduplicate(persona_dir)
