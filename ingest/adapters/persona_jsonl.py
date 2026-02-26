"""
persona_jsonl.py -- Adapter for the Data Portability Hackathon 2026 persona dataset.

Reads all JSONL files from a persona directory and returns a list of RawRecord.
Also loads persona_profile.json for contributor metadata.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from ingest.models import RawRecord

logger = logging.getLogger(__name__)

JSONL_FILES: list[str] = [
    "lifelog.jsonl",
    "emails.jsonl",
    "calendar.jsonl",
    "social_posts.jsonl",
    "transactions.jsonl",
    "conversations.jsonl",
    "files_index.jsonl",
]


def load_persona_profile(persona_dir: Path) -> dict[str, Any]:
    """Load persona_profile.json and return it as a dict."""
    profile_path = persona_dir / "persona_profile.json"
    if not profile_path.exists():
        raise FileNotFoundError(f"Missing persona_profile.json in {persona_dir}")
    with open(profile_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_all_records(persona_dir: Path) -> list[RawRecord]:
    """
    Load all JSONL files from a persona directory.

    Returns a flat list of RawRecord objects across all source files.
    Skips files that do not exist (not every persona has all 7 files).
    Skips malformed lines with a warning.
    """
    persona_path = Path(persona_dir)
    if not persona_path.is_dir():
        raise NotADirectoryError(f"Persona directory not found: {persona_path}")

    records: list[RawRecord] = []

    for filename in JSONL_FILES:
        filepath = persona_path / filename
        if not filepath.exists():
            logger.info("Skipping missing file: %s", filepath)
            continue

        line_count = 0
        with open(filepath, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, start=1):
                stripped = line.strip()
                if not stripped:
                    continue
                try:
                    data = json.loads(stripped)
                    record = RawRecord(**data)
                    records.append(record)
                    line_count += 1
                except (json.JSONDecodeError, Exception) as exc:
                    logger.warning(
                        "Skipping malformed line %d in %s: %s",
                        line_num,
                        filename,
                        exc,
                    )

        logger.info("Loaded %d records from %s", line_count, filename)

    logger.info("Total records loaded from %s: %d", persona_path.name, len(records))
    return records
